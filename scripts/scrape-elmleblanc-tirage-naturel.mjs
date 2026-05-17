import fs from "node:fs/promises";
import path from "node:path";

const BASE = "https://www.catalogueinteractif.elmlecube.fr";
const DRAWINGS_BASE = "https://www.elmleblanc-services.fr/Catalogue/drawings/";
const DOCUMENTS_BASE = "https://www.elmleblanc-services.fr/Catalogue/documents/";
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...value] = arg.slice(2).split("=");
      return [key, value.join("=")];
    }),
);
const FILTER_ID = args.get("filter") || "71";
const BRAND_ID = args.get("brand") || "E0";
const SLUG = args.get("slug") || "elmleblanc-tirage-naturel";
const CATEGORY =
  args.get("category") || "elm.leblanc > Gaz > Chaudiere murale > Basse temperature > Tirage naturel";
const OUT_DIR = process.cwd();
const RAW_DIR = path.join(OUT_DIR, "backups", `${SLUG}-raw`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;?/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&eacute;/g, "e")
    .replace(/&egrave;/g, "e")
    .replace(/&ecirc;/g, "e")
    .replace(/&agrave;/g, "a")
    .replace(/&ccedil;/g, "c")
    .replace(/&deg;/g, " deg")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(value.replace(/<[^>]*>/g, " "));
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? "");
}

async function fetchText(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Codex catalogue extraction",
          Accept: "text/html,application/json,*/*",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === retries) throw new Error(`${url} -> ${error.message}`);
      await sleep(600 * attempt);
    }
  }
}

async function writeJson(fileName, data) {
  await fs.writeFile(path.join(OUT_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeJs(fileName, variableName, data, header) {
  const content = [
    header,
    `globalThis.${variableName} = ${JSON.stringify(data, null, 2)};`,
    "",
  ].join("\n");
  await fs.writeFile(path.join(OUT_DIR, fileName), content, "utf8");
}

function parseProductPage(html) {
  const designation = stripTags(html.match(/<div id="designation"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const title = stripTags(html.match(/<div id="productTitle"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const mainDrawing = html.match(/loadImage\("https:\/\/www\.elmleblanc-services\.fr\/Catalogue\/drawings\/"\+"([^"]+)"/i)?.[1] ?? "";
  const codeErrorReference = html.match(/\/Product\/CodeError\?Reference=([^&"]*)&IdCode=/i)?.[1] ?? "";
  return {
    productTitle: title,
    fullDesignation: designation.replace(/^Designation complete\s*:\s*/i, "").replace(/^Désignation complète\s*:\s*/i, ""),
    mainDrawing,
    mainDrawingUrl: mainDrawing ? `${DRAWINGS_BASE}${mainDrawing}` : "",
    codeErrorReference: decodeURIComponent(codeErrorReference),
  };
}

function parseTree(html) {
  const rootPicture = html.match(/<span class="caret root"[^>]*picture="([^"]+)"/i)?.[1] ?? "";
  const views = [];
  if (rootPicture) {
    views.push({
      level: "root",
      position: "",
      title: "Vue d'ensemble",
      pdf: rootPicture,
      url: `${DRAWINGS_BASE}${rootPicture}`,
    });
  }

  const sections = [];
  const sectionRegex = /<span class="caret children"([^>]*)>([\s\S]*?)<\/span>\s*<ul class="nested">([\s\S]*?)(?=<\/ul>\s*<\/li>)/gi;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(html))) {
    const sectionAttrs = sectionMatch[1];
    const sectionTitle = stripTags(sectionMatch[2]);
    const section = {
      position: attr(sectionAttrs, "posNo"),
      title: sectionTitle,
      picture: attr(sectionAttrs, "picture"),
      pictureUrl: "",
      parts: [],
    };
    section.pictureUrl = section.picture ? `${DRAWINGS_BASE}${section.picture}` : "";
    if (section.picture) {
      views.push({
        level: "section",
        position: section.position,
        title: section.title,
        pdf: section.picture,
        url: section.pictureUrl,
      });
    }

    const leafRegex = /<span class="leaf"([^>]*)>([\s\S]*?)<\/span>/gi;
    let leafMatch;
    while ((leafMatch = leafRegex.exec(sectionMatch[3]))) {
      const leafAttrs = leafMatch[1];
      const detailsPath = attr(leafAttrs, "details");
      const detailsUrl = detailsPath ? new URL(detailsPath, BASE).toString() : "";
      const detailUrl = new URL(detailsUrl || BASE);
      section.parts.push({
        position: attr(leafAttrs, "posNo"),
        label: stripTags(leafMatch[2]),
        itemId: detailUrl.searchParams.get("Id") ?? "",
        reference: detailUrl.searchParams.get("Reference") ?? "",
        detailsPath,
        detailsUrl,
      });
    }
    sections.push(section);
  }

  return { rootPicture, views, sections };
}

function parseDocuments(html) {
  const documents = [];
  const docRegex = /<div class="document[^"]*"([^>]*)>([\s\S]*?)<\/div>/gi;
  let match;
  const seen = new Set();
  while ((match = docRegex.exec(html))) {
    const pdfUri = attr(match[1], "pdfUri");
    if (!pdfUri || seen.has(pdfUri)) continue;
    seen.add(pdfUri);
    documents.push({
      title: stripTags(match[2]),
      mimeType: attr(match[1], "mimeType"),
      uri: pdfUri,
      url: `${DOCUMENTS_BASE}${pdfUri}`,
    });
  }
  return documents;
}

function parsePartDetails(html) {
  const alert = stripTags(html.match(/<div class="alert[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
  const copyRefInput = html.match(/<input[^>]*id="copyRef"[^>]*>/i)?.[0] ?? html.match(/<input[^>]*value="[^"]+"[^>]*id="copyRef"[^>]*>/i)?.[0] ?? "";
  const copiedReference = attr(copyRefInput, "value");
  const designation = stripTags(
    html.match(/<div class="label[^"]*"[^>]*>[\s\S]*?signation[\s\S]*?<\/div>\s*<div class="info[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "",
  );
  const labels = {};
  const fieldRegex = /<div class="label[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="info[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(html))) {
    labels[stripTags(fieldMatch[1])] = stripTags(fieldMatch[2]);
  }
  return {
    statusMessage: alert,
    reference: labels.Reference ?? labels["Référence"] ?? copiedReference,
    designation: labels.Designation ?? labels["Désignation"] ?? designation,
    ean: labels["Code EAN"] ?? "",
    hasUseCase: /GoToUseCase/i.test(html),
    hasSuccessorBlock: /id="successorDiv"/i.test(html),
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

function collectUniqueParts(partsByModel) {
  const uniquePartsMap = new Map();
  for (const model of Object.values(partsByModel)) {
    for (const section of model.sections) {
      for (const part of section.parts) {
        const key = part.reference || part.detailsUrl;
        if (!key || uniquePartsMap.has(key)) continue;
        uniquePartsMap.set(key, part);
      }
    }
  }
  return uniquePartsMap;
}

async function fetchPartDetails(uniqueParts) {
  const partDetailsByReference = {};
  await mapWithConcurrency(uniqueParts, 4, async (part, index) => {
    if (!part.detailsUrl) return;
    if ((index + 1) % 100 === 0 || index === 0) {
      console.log(`Details pieces: ${index + 1}/${uniqueParts.length}`);
    }
    try {
      const html = await fetchText(part.detailsUrl, 2);
      partDetailsByReference[part.reference || part.detailsUrl] = {
        ...parsePartDetails(html),
        detailsUrl: part.detailsUrl,
      };
    } catch (error) {
      partDetailsByReference[part.reference || part.detailsUrl] = {
        detailsUrl: part.detailsUrl,
        error: error.message,
      };
    }
    await sleep(80);
  });
  return partDetailsByReference;
}

async function refreshDetailsOnly() {
  const partsByModel = JSON.parse(await fs.readFile(path.join(OUT_DIR, `${SLUG}-parts-by-model.json`), "utf8"));
  const metadata = JSON.parse(await fs.readFile(path.join(OUT_DIR, `${SLUG}-metadata.json`), "utf8"));
  const uniquePartsMap = collectUniqueParts(partsByModel);
  const uniqueParts = [...uniquePartsMap.values()];

  console.log(`Pieces uniques a detailler: ${uniquePartsMap.size}`);
  const partDetailsByReference = await fetchPartDetails(uniqueParts);
  metadata.detailedPartReferences = Object.keys(partDetailsByReference).length;
  metadata.detailsRefreshedAt = new Date().toISOString();

  const header = `// Generated from elmLeCube catalogue: ${CATEGORY}.\n// ${metadata.modelCount} models | ${metadata.totalPartOccurrences} part occurrences | ${metadata.uniquePartReferences} unique part references.`;
  await writeJson(`${SLUG}-metadata.json`, metadata);
  await writeJson(`${SLUG}-part-details.json`, partDetailsByReference);
  await writeJs(`${SLUG}-part-details.js`, `${SLUG.toUpperCase().replaceAll("-", "_")}_PART_DETAILS`, partDetailsByReference, header);
  console.log(JSON.stringify({
    detailedPartReferences: metadata.detailedPartReferences,
    detailsRefreshedAt: metadata.detailsRefreshedAt,
  }, null, 2));
}

async function main() {
  if (process.argv.includes("--details-only")) {
    await refreshDetailsOnly();
    return;
  }

  await fs.mkdir(RAW_DIR, { recursive: true });

  const listUrl = `${BASE}/Product/GetProductByFilter?gridDevices-page=1&gridDevices-pageSize=500&idFilter=${FILTER_ID}&idBrand=${BRAND_ID}`;
  const listJson = await fetchText(listUrl);
  await fs.writeFile(path.join(RAW_DIR, "product-list.json"), listJson, "utf8");
  const list = JSON.parse(listJson);
  const sourceModels = list.Data ?? [];

  console.log(`Modeles trouves: ${sourceModels.length}`);

  const models = [];
  const partsByModel = {};
  const explodedViews = {};
  const documentsByModel = {};

  for (let i = 0; i < sourceModels.length; i++) {
    const source = sourceModels[i];
    const productUrl = `${BASE}/Product?Id=${source.Id}`;
    const treeUrl = `${BASE}/Product/Tree?Id=${source.Id}`;
    const documentUrl = `${BASE}/Product/Document?reference=${encodeURIComponent(source.Reference)}`;

    console.log(`[${i + 1}/${sourceModels.length}] ${source.Reference} ${source.DisplayName || ""}`);

    const [productHtml, treeHtml, documentHtml] = await Promise.all([
      fetchText(productUrl),
      fetchText(treeUrl),
      fetchText(documentUrl),
    ]);

    await fs.writeFile(path.join(RAW_DIR, `${source.Id}-product.html`), productHtml, "utf8");
    await fs.writeFile(path.join(RAW_DIR, `${source.Id}-tree.html`), treeHtml, "utf8");
    await fs.writeFile(path.join(RAW_DIR, `${source.Id}-documents.html`), documentHtml, "utf8");

    const product = parseProductPage(productHtml);
    const tree = parseTree(treeHtml);
    const documents = parseDocuments(documentHtml);
    const partCount = tree.sections.reduce((sum, section) => sum + section.parts.length, 0);

    models.push({
      id: String(source.Id),
      reference: source.Reference ?? "",
      displayName: source.DisplayName ?? "",
      familyName: source.FamilyName ?? "",
      category: CATEGORY,
      productTitle: product.productTitle,
      fullDesignation: product.fullDesignation,
      productUrl,
      mainDrawing: product.mainDrawing || tree.rootPicture,
      mainDrawingUrl: product.mainDrawingUrl || (tree.rootPicture ? `${DRAWINGS_BASE}${tree.rootPicture}` : ""),
      codeErrorReference: product.codeErrorReference,
      sectionCount: tree.sections.length,
      partCount,
      documentCount: documents.length,
    });

    partsByModel[String(source.Id)] = {
      modelId: String(source.Id),
      reference: source.Reference ?? "",
      displayName: source.DisplayName ?? "",
      familyName: source.FamilyName ?? "",
      sections: tree.sections,
    };
    explodedViews[String(source.Id)] = tree.views;
    documentsByModel[String(source.Id)] = documents;

    await sleep(150);
  }

  const uniquePartsMap = collectUniqueParts(partsByModel);

  console.log(`Pieces uniques a detailler: ${uniquePartsMap.size}`);
  const uniqueParts = [...uniquePartsMap.values()];
  const partDetailsByReference = await fetchPartDetails(uniqueParts);

  const metadata = {
    source: `${BASE}/Product/ProductByFilter?idFilter=${FILTER_ID}&idBrand=${BRAND_ID}`,
    category: CATEGORY,
    filterId: FILTER_ID,
    brandId: BRAND_ID,
    scrapedAt: new Date().toISOString(),
    modelCount: models.length,
    totalPartOccurrences: Object.values(partsByModel).reduce(
      (sum, model) => sum + model.sections.reduce((sectionSum, section) => sectionSum + section.parts.length, 0),
      0,
    ),
    uniquePartReferences: uniquePartsMap.size,
    detailedPartReferences: Object.keys(partDetailsByReference).length,
    totalExplodedViews: Object.values(explodedViews).reduce((sum, views) => sum + views.length, 0),
    totalDocuments: Object.values(documentsByModel).reduce((sum, docs) => sum + docs.length, 0),
  };

  const header = `// Generated from elmLeCube catalogue: ${CATEGORY}.\n// ${metadata.modelCount} models | ${metadata.totalPartOccurrences} part occurrences | ${metadata.uniquePartReferences} unique part references.`;

  const variablePrefix = SLUG.toUpperCase().replaceAll("-", "_");
  await writeJson(`${SLUG}-metadata.json`, metadata);
  await writeJson(`${SLUG}-models.json`, models);
  await writeJson(`${SLUG}-parts-by-model.json`, partsByModel);
  await writeJson(`${SLUG}-exploded-views.json`, explodedViews);
  await writeJson(`${SLUG}-documents-by-model.json`, documentsByModel);
  await writeJson(`${SLUG}-part-details.json`, partDetailsByReference);

  await writeJs(`${SLUG}-models.js`, `${variablePrefix}_MODELS`, models, header);
  await writeJs(`${SLUG}-parts-by-model.js`, `${variablePrefix}_PARTS_BY_MODEL`, partsByModel, header);
  await writeJs(`${SLUG}-exploded-views.js`, `${variablePrefix}_EXPLODED_VIEWS`, explodedViews, header);
  await writeJs(`${SLUG}-documents-by-model.js`, `${variablePrefix}_DOCUMENTS_BY_MODEL`, documentsByModel, header);
  await writeJs(`${SLUG}-part-details.js`, `${variablePrefix}_PART_DETAILS`, partDetailsByReference, header);

  console.log(JSON.string