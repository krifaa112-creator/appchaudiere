import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const SOURCE_HTML = "piecesxpress-chappee-odia.html";
const SOURCE_URL =
  "https://www.piecesxpress.com/nomenclature-14199-0-pieces-detachees-chaudiere-chappee-odia-hte-odia-solar-hte-g8-modular.htm";
const MODEL_ID = "piecesxpress-14199";
const MODEL_NAME = "ODIA HTE / ODIA SOLAR HTE - G8 Modular";
const OUT_PREFIX = "chappee-odia-hte";
const JS_PREFIX = "CHAPPEE_ODIA_HTE";
const PAGES = ["1", "3", "5", "7", "9", "11"];

const html = await fs.readFile(SOURCE_HTML, "utf8");
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "domcontentloaded" });

const sections = await page.evaluate((pages) => {
  return pages.map((pageNumber) => {
    const root = document.querySelector(`#ref_fabricant_page_${pageNumber}`);
    const rows = root ? [...root.querySelectorAll("tr")] : [];
    const parts = rows
      .map((row) => {
        const reference = row.querySelector("[id^='ref_fabricant_ligne_']")?.textContent?.trim() || "";
        const label = row.querySelector("[id^='designation_ligne_']")?.textContent?.replace(/\s+/g, " ").trim() || "";
        const position = row.querySelector("[id^='position_ligne_']")?.textContent?.replace(/\s+/g, " ").trim() || "";
        return reference && label ? { reference, label, position } : null;
      })
      .filter(Boolean);

    return {
      id: `659171240-${pageNumber}`,
      title: `Page ${pageNumber}`,
      code: `Page ${pageNumber}`,
      order: pageNumber,
      sourceUrl: `${location.origin}/docs/chappee/659171240-superzoom-${pageNumber}.jpg`,
      imageBlobId: `chappee-odia-659171240-${pageNumber}.jpg`,
      parts
    };
  });
}, PAGES);

await browser.close();

const models = [
  {
    id: MODEL_ID,
    familyId: "piecesxpress-odia",
    familyName: "ODIA HTE / ODIA SOLAR HTE",
    category: "Chaudières sol gaz condensation",
    displayName: MODEL_NAME,
    productUrl: SOURCE_URL
  }
];

const viewsByModel = {
  [MODEL_ID]: sections.map((section) => ({
    id: section.id,
    title: section.title,
    code: section.code,
    order: section.order,
    sourceUrl: section.sourceUrl,
    imageUrl: section.sourceUrl,
    imageBlobId: section.imageBlobId,
    thumbnailBlobId: section.imageBlobId,
    url: "",
    externalUrl: ""
  }))
};

const partsByModel = {
  [MODEL_ID]: {
    modelId: MODEL_ID,
    familyId: "piecesxpress-odia",
    modelName: MODEL_NAME,
    familyName: "ODIA HTE / ODIA SOLAR HTE",
    sections
  }
};

const metadata = {
  manufacturer: "Chappee",
  source: SOURCE_URL,
  sourcePdf: "https://www.piecesxpress.com/docs/chappee/659171240.pdf",
  category: "Chaudières sol gaz condensation",
  extractedAt: new Date().toISOString(),
  familyCount: 1,
  processedFamilies: 1,
  modelCount: models.length,
  schemaCount: sections.length,
  partOccurrences: sections.reduce((sum, section) => sum + section.parts.length, 0),
  pricesIncluded: false,
  errors: []
};

const jsVar = (name, data) => `window.${name} = ${JSON.stringify(data, null, 2)};\n`;

await fs.writeFile(`${OUT_PREFIX}-metadata.json`, JSON.stringify(metadata, null, 2), "utf8");
await fs.writeFile(`${OUT_PREFIX}-models.json`, JSON.stringify(models, null, 2), "utf8");
await fs.writeFile(`${OUT_PREFIX}-models.js`, jsVar(`${JS_PREFIX}_MODELS`, models), "utf8");
await fs.writeFile(`${OUT_PREFIX}-exploded-views.json`, JSON.stringify(viewsByModel, null, 2), "utf8");
await fs.writeFile(`${OUT_PREFIX}-exploded-views.js`, jsVar(`${JS_PREFIX}_EXPLODED_VIEWS`, viewsByModel), "utf8");
await fs.writeFile(`${OUT_PREFIX}-parts-by-model.json`, JSON.stringify(partsByModel, null, 2), "utf8");
await fs.writeFile(`${OUT_PREFIX}-parts-by-model.js`, jsVar(`${JS_PREFIX}_PARTS_BY_MODEL`, partsByModel), "utf8");

console.log(JSON.stringify(metadata, null, 2));
