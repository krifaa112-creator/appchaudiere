import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function toJsVarPrefix(prefix) {
  return String(prefix || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const BASE_URL = "https://pieces.chappee.com";
const ROOT_URL = getArg("root-url", `${BASE_URL}/ListeFamilles.aspx?FAMILLE_PARENT_ID=41`);
const OUT_PREFIX = getArg("out-prefix", "chappee-gaz-murales");
const CATEGORY_LABEL = getArg("category", "Chaudières gaz murales");
const JS_VAR_PREFIX = toJsVarPrefix(getArg("var-prefix", OUT_PREFIX));
const USER_DATA_DIR = path.resolve(".chappee-playwright-profile");
const ASSET_DIR = path.resolve("assets", "sparecheck-documents");
const KEEP_BROWSER_OPEN = process.argv.includes("--keep-open") || process.env.CHAPPEE_KEEP_BROWSER_OPEN === "1";

function absoluteUrl(href) {
  return new URL(href, BASE_URL).href;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function waitForLoggedIn(page) {
  for (;;) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    const url = new URL(page.url());
    const loginVisible = await page.locator("text=Accès membres").count().catch(() => 0);
    const emailVisible = await page.locator("input[type='password']").count().catch(() => 0);
    if (!loginVisible && !emailVisible && url.pathname.toLowerCase().endsWith("/listefamilles.aspx")) return;

    console.log("Connecte-toi dans la fenêtre Edge ouverte, puis laisse le script continuer...");
    await page.waitForTimeout(3000);
  }
}

async function readFamilies(page) {
  await page.goto(ROOT_URL, { waitUntil: "domcontentloaded" });
  await waitForLoggedIn(page);
  await page.goto(ROOT_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  return uniqueBy(
    await page.$$eval("a", (links) =>
      links
        .map((link) => ({
          id: new URL(link.href, location.href).searchParams.get("FAMILLE_ID") || "",
          label: link.textContent.trim(),
          url: link.href
        }))
        .filter((family) => family.id && family.label),
    ),
    (family) => family.id,
  );
}

async function readModels(page, family) {
  await page.goto(family.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  return uniqueBy(
    await page.$$eval("a", (links, categoryLabel) =>
      links
        .map((link) => {
          const url = new URL(link.href, location.href);
          return {
            id: url.searchParams.get("IDGAM") || "",
            familyId: url.searchParams.get("IDFAM") || "",
            familyName: "",
            category: categoryLabel,
            displayName: link.textContent.trim(),
            productUrl: link.href
          };
        })
        .filter((model) => model.id && model.familyId && model.displayName),
      CATEGORY_LABEL,
    ),
    (model) => `${model.id}|${model.familyId}`,
  ).map((model) => ({ ...model, familyName: family.label }));
}

async function readSchemaIds(page, model) {
  await page.goto(model.productUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  return uniqueBy(
    await page.$$eval("a", (links) =>
      links
        .map((link) => {
          const href = link.getAttribute("href") || "";
          const url = new URL(link.href || href, location.href);
          const id = url.searchParams.get("IDSCG") || "";
          return {
            id,
            sourceUrl: link.href || (id ? new URL(`/FicheSchema.aspx?IDSCG=${id}`, location.origin).href : "")
          };
        })
        .filter((schema) => schema.id),
    ),
    (schema) => schema.id,
  );
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function readSchema(page, request, schema, order) {
  await page.goto(schema.sourceUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const image = document.querySelector("#schemaImage");
    const rows = [...document.querySelectorAll("tr")];
    const parts = rows
      .map((row) => {
        const cells = [...row.querySelectorAll("td")];
        if (cells.length < 3) return null;
        const reference = cells[0].textContent.trim();
        const labelNode = cells[1].querySelector("[title]") || cells[1];
        const label = (labelNode.getAttribute?.("title") || cells[1].getAttribute("title") || cells[1].textContent).trim();
        const position = cells[2].textContent.trim();
        if (!/^[A-Z0-9]{4,}$/.test(reference) || !/^\d+$/.test(position)) return null;
        return { reference, label, position };
      })
      .filter(Boolean);
    const activeTab = document.querySelector(".nav-tabs .active a, .nav-tabs .active, .tab-pane.active");
    return {
      title: document.title.split("-->").pop()?.trim() || "",
      code: activeTab?.textContent?.trim() || "",
      imageUrl: image?.src || "",
      parts
    };
  });

  const imageBlobId = `chappee-${schema.id}.jpg`;
  if (data.imageUrl) {
    const response = await request.get(data.imageUrl);
    if (response.ok()) {
      await fs.mkdir(ASSET_DIR, { recursive: true });
      await fs.writeFile(path.join(ASSET_DIR, imageBlobId), await response.body());
    }
  }

  return {
    view: {
      id: schema.id,
      code: cleanText(data.code),
      title: cleanText(data.title) || `Planche ${schema.id}`,
      order: String(order),
      sourceUrl: schema.sourceUrl,
      url: "",
      externalUrl: "",
      imageUrl: data.imageUrl,
      imageBlobId,
      thumbnailBlobId: imageBlobId
    },
    section: {
      id: schema.id,
      title: cleanText(data.title) || `Planche ${schema.id}`,
      code: cleanText(data.code),
      order: String(order),
      sourceUrl: schema.sourceUrl,
      imageBlobId,
      parts: data.parts.map((part) => ({
        reference: cleanText(part.reference),
        label: cleanText(part.label).replace(/\s+\.\.\.$/, ""),
        position: cleanText(part.position)
      }))
    }
  };
}

async function saveData({ metadata, models, viewsByModel, partsByModel }) {
  const jsVar = (name, data) => `window.${name} = ${JSON.stringify(data, null, 2)};\n`;
  await fs.writeFile(`${OUT_PREFIX}-metadata.json`, JSON.stringify(metadata, null, 2), "utf8");
  await fs.writeFile(`${OUT_PREFIX}-models.json`, JSON.stringify(models, null, 2), "utf8");
  await fs.writeFile(`${OUT_PREFIX}-models.js`, jsVar(`${JS_VAR_PREFIX}_MODELS`, models), "utf8");
  await fs.writeFile(`${OUT_PREFIX}-exploded-views.json`, JSON.stringify(viewsByModel, null, 2), "utf8");
  await fs.writeFile(`${OUT_PREFIX}-exploded-views.js`, jsVar(`${JS_VAR_PREFIX}_EXPLODED_VIEWS`, viewsByModel), "utf8");
  await fs.writeFile(`${OUT_PREFIX}-parts-by-model.json`, JSON.stringify(partsByModel, null, 2), "utf8");
  await fs.writeFile(`${OUT_PREFIX}-parts-by-model.js`, jsVar(`${JS_VAR_PREFIX}_PARTS_BY_MODEL`, partsByModel), "utf8");
}

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  channel: "msedge",
  headless: false,
  viewport: { width: 1440, height: 950 }
});

const page = context.pages()[0] || (await context.newPage());
page.setDefaultTimeout(20000);

const families = await readFamilies(page);
console.log(`Familles trouvées: ${families.length}`);
const models = [];
const viewsByModel = {};
const partsByModel = {};
const errors = [];
let schemaCount = 0;
let partOccurrences = 0;

for (const family of families) {
  console.log(`Famille ${families.indexOf(family) + 1}/${families.length}: ${family.label}`);
  const familyModels = await readModels(page, family);

  for (const model of familyModels) {
    console.log(`  Modèle: ${model.displayName}`);
    models.push(model);
    const sections = [];
    const views = [];

    try {
      const schemaIds = await readSchemaIds(page, model);
      for (const [index, schema] of schemaIds.entries()) {
        try {
          const { view, section } = await readSchema(page, context.request, schema, index + 1);
          views.push(view);
          sections.push(section);
          schemaCount += 1;
          partOccurrences += section.parts.length;
        } catch (error) {
          errors.push({ level: "schema", model: model.displayName, schema: schema.id, error: String(error.message || error) });
        }
      }
    } catch (error) {
      errors.push({ level: "model", model: model.displayName, error: String(error.message || error) });
    }

    viewsByModel[model.id] = views;
    partsByModel[model.id] = {
      modelId: model.id,
      familyId: model.familyId,
      modelName: model.displayName,
      familyName: model.familyName,
      sections
    };
  }

  await saveData({
    metadata: {
      manufacturer: "Chappée",
      source: ROOT_URL,
      category: CATEGORY_LABEL,
      extractedAt: new Date().toISOString(),
      familyCount: families.length,
      processedFamilies: families.indexOf(family) + 1,
      modelCount: models.length,
      schemaCount,
      partOccurrences,
      pricesIncluded: false,
      errors
    },
    models,
    viewsByModel,
    partsByModel
  });
}

await saveData({
  metadata: {
    manufacturer: "Chappée",
    source: ROOT_URL,
    category: CATEGORY_LABEL,
    extractedAt: new Date().toISOString(),
    familyCount: families.length,
    processedFamilies: families.length,
    modelCount: models.length,
    schemaCount,
    partOccurrences,
    pricesIncluded: false,
    errors
  },
  models,
  viewsByModel,
  partsByModel
});

console.log(JSON.stringify({ families: families.length, models: models.length, schemaCount, partOccurrences, errors: errors.length }, null, 2));

if (KEEP_BROWSER_OPEN) {
  console.log("Extraction terminee. Fenetre gardee ouverte: ferme-la manuellement quand tu as fini.");
  await new Promise(() => {});
} else {
  await context.close();
}
