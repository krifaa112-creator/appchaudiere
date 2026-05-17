const STORAGE_KEY = "boiler-parts-library-sparecheck-v5";
const USERS_KEY = "boiler-core-users-v1";
const SESSION_KEY = "boiler-core-session-v1";
const INVENTORY_RESET_KEY = "boiler-core-inventory-reset-sparecheck-v5";
const NOTES_CLEAR_KEY = "boiler-core-notes-cleared-v1";
const SAUNIER_PARTS_IMPORT_KEY = "boiler-core-saunier-parts-import-v10";
const ELMLEBLANC_PARTS_IMPORT_KEY = "boiler-core-elmleblanc-parts-import-v1";
const DELETED_SEED_BOILERS_KEY = "boiler-core-deleted-seed-boilers-sparecheck-v4";
const EXPLODED_VIEW_URLS = Object.fromEntries(
  Object.entries({
    "ISOMAX CONDENS T 31 CS 1 SF": "https://www.dispart.fr/vues-eclatees#/machine/28150/?marque_nom=Saunier%20Duval",
    "THEMAPLUS H CONDENS MA 36 CF 1":
      "https://www.dispart.fr/vues-eclatees#/machine/28169/?marque_nom=Saunier%20Duval",
    ...(globalThis.SAUNIER_DUVAL_EXPLODED_VIEW_URLS || {})
  }).map(([model, url]) => [normalizeModelKey(model), url])
);

if (!localStorage.getItem(INVENTORY_RESET_KEY)) {
  localStorage.setItem(STORAGE_KEY, "[]");
  localStorage.setItem(INVENTORY_RESET_KEY, "done");
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const sampleData = [
  {
    id: createId(),
    manufacturer: "Vaillant",
    model: "ecoTEC plus 831",
    barcode: "",
    specUrl: "https://www.vaillant.fr/particuliers/produits/ecotec-plus/",
    explodedViewUrl: "",
    notes: "",
    parts: [
      { name: "Électrode d'allumage", number: "090709", category: "Allumage" },
      { name: "Cartouche de vanne trois voies", number: "0020132682", category: "Hydraulique" },
      { name: "Ensemble ventilateur", number: "193593", category: "Combustion" }
    ]
  },
  {
    id: createId(),
    manufacturer: "Worcester Bosch",
    model: "Greenstar 30i",
    barcode: "",
    specUrl: "https://www.worcester-bosch.co.uk/products/boilers/directory/greenstar-i",
    explodedViewUrl: "",
    notes: "",
    parts: [
      { name: "Soupape de sécurité", number: "87161064330", category: "Sécurité" },
      { name: "Adaptateur de turbine de débit", number: "87161064320", category: "Eau" }
    ]
  },
  {
    id: createId(),
    manufacturer: "Saunier Duval",
    model: "Thema plus 25",
    barcode: "",
    specUrl: "https://www.saunierduval.fr/particulier/produits/thema-plus-condens/",
    explodedViewUrl: "",
    notes: "",
    parts: []
  }
];

const saunierDuvalSeedData = getSaunierDuvalSeedData();
const saunierDuvalPartsByModel = getSaunierDuvalPartsByModel();
const elmLeblancSeedData = getElmLeblancSeedData();
const elmLeblancPartsByModel = getElmLeblancPartsByModel();

const state = {
  boilers: loadBoilers(),
  query: "",
  manufacturerFilter: "",
  sortMode: "manufacturer",
  editingId: null
};

const elements = {
  appShell: document.querySelector("#appShell"),
  authScreen: document.querySelector("#authScreen"),
  showLogin: document.querySelector("#showLogin"),
  showSignup: document.querySelector("#showSignup"),
  guestLogin: document.querySelector("#guestLogin"),
  loginForm: document.querySelector("#loginForm"),
  signupForm: document.querySelector("#signupForm"),
  loginIdentifier: document.querySelector("#loginIdentifier"),
  loginPassword: document.querySelector("#loginPassword"),
  signupUsername: document.querySelector("#signupUsername"),
  signupEmail: document.querySelector("#signupEmail"),
  signupPassword: document.querySelector("#signupPassword"),
  signupRoleHint: document.querySelector("#signupRoleHint"),
  authMessage: document.querySelector("#authMessage"),
  currentUser: document.querySelector("#currentUser"),
  currentRole: document.querySelector("#currentRole"),
  logoutButton: document.querySelector("#logoutButton"),
  permissionNotice: document.querySelector("#permissionNotice"),
  usersList: document.querySelector("#usersList"),
  form: document.querySelector("#boilerForm"),
  manufacturer: document.querySelector("#manufacturer"),
  model: document.querySelector("#model"),
  barcode: document.querySelector("#barcode"),
  specUrl: document.querySelector("#specUrl"),
  explodedViewUrl: document.querySelector("#explodedViewUrl"),
  notes: document.querySelector("#notes"),
  partsList: document.querySelector("#partsList"),
  partRowTemplate: document.querySelector("#partRowTemplate"),
  addPart: document.querySelector("#addPart"),
  saveModel: document.querySelector("#saveModel"),
  cancelEdit: document.querySelector("#cancelEdit"),
  search: document.querySelector("#modelSearch"),
  submitSearch: document.querySelector("#submitSearch"),
  manufacturerFilter: document.querySelector("#manufacturerFilter"),
  sortMode: document.querySelector("#sortMode"),
  clearSearch: document.querySelector("#clearSearch"),
  results: document.querySelector("#results"),
  resultsSummary: document.querySelector("#resultsSummary"),
  totalModels: document.querySelector("#totalModels"),
  metricModels: document.querySelector("#metricModels"),
  metricParts: document.querySelector("#metricParts"),
  metricManufacturers: document.querySelector("#metricManufacturers"),
  metricComplete: document.querySelector("#metricComplete"),
  metricMissing: document.querySelector("#metricMissing"),
  quickBackup: document.querySelector("#quickBackup"),
  exportJson: document.querySelector("#exportJson"),
  exportCsv: document.querySelector("#exportCsv"),
  importJson: document.querySelector("#importJson"),
  openScanner: document.querySelector("#openScanner"),
  closeScanner: document.querySelector("#closeScanner"),
  scannerModal: document.querySelector("#scannerModal"),
  cameraPreview: document.querySelector("#cameraPreview"),
  scannerStatus: document.querySelector("#scannerStatus"),
  manualBarcode: document.querySelector("#manualBarcode"),
  manualScan: document.querySelector("#manualScan"),
  ocrScan: document.querySelector("#ocrScan"),
  detailModal: document.querySelector("#detailModal"),
  detailTitle: document.querySelector("#detailTitle"),
  detailContent: document.querySelector("#detailContent"),
  closeDetail: document.querySelector("#closeDetail")
};

let scannerStream = null;
let scannerTimer = null;
let scannerOcrActive = false;
let currentUser = null;

const defaultUsers = [
  {
    id: "default-admin-krifa",
    username: "krifa",
    email: "krifaa112@gmail.com",
    role: "admin",
    salt: "0296b3cc3fcd930485fded2d91153cc6",
    passwordHash: "a2db63009bc3c16e620a60df31b749b787f84aad0ab6e7b1a2e258d586a4e009",
    createdAt: "2026-05-09T00:00:00.000Z"
  }
];

function getUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    if (!users.length) {
      saveUsers(defaultUsers);
      return defaultUsers;
    }

    const normalized = normalizeUsers(users);
    const hasDefaultUser = normalized.some(
      (user) => user.email === defaultUsers[0].email || normalizeIdentifier(user.username || "") === defaultUsers[0].username
    );
    if (hasDefaultUser) return normalized;

    const merged = [...normalized, ...defaultUsers];
    saveUsers(merged);
    return merged;
  } catch {
    saveUsers(defaultUsers);
    return defaultUsers;
  }
}

function normalizeUsers(users) {
  let changed = false;
  const normalized = users.filter((user) => user && typeof user === "object").map((user, index) => {
    if (user.role) return user;
    changed = true;
    return { ...user, role: index === 0 ? "admin" : "operator" };
  });

  if (changed) {
    saveUsers(normalized);
  }

  return normalized;
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalizeIdentifier(value) {
  return value.trim().toLowerCase();
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  if (crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  if (!crypto.subtle) {
    let hash = 5381;
    const value = `${salt}:${password}`;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 33) ^ value.charCodeAt(index);
    }
    return `fallback-${hash >>> 0}`;
  }

  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setAuthMessage(message, type = "") {
  elements.authMessage.textContent = message;
  elements.authMessage.dataset.type = type;
}

function showAuthMode(mode) {
  const isSignup = mode === "signup";
  elements.signupForm.classList.toggle("hidden", !isSignup);
  elements.loginForm.classList.toggle("hidden", isSignup);
  elements.showSignup.classList.toggle("active", isSignup);
  elements.showLogin.classList.toggle("active", !isSignup);
  if (isSignup) {
    elements.signupRoleHint.textContent =
      getUsers().length === 0
        ? "Le premier compte créé devient Admin."
        : "Les nouveaux comptes sont créés en Operator avec accès lecture seule.";
  }
  setAuthMessage("");
}

function showApp(user) {
  currentUser = { ...user, role: user.role || "operator" };
  elements.currentUser.textContent = user.username || user.email;
  elements.currentRole.textContent = currentUser.role === "admin" ? "Admin - lecture/modification" : "Operator - lecture seule";
  elements.authScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  applyPermissions();
  renderResults();
  renderUsersList();
}

function showGuestApp() {
  localStorage.removeItem(SESSION_KEY);
  showApp({
    id: "guest-session",
    username: "Invit\u00e9",
    email: "",
    role: "operator",
    createdAt: new Date().toISOString()
  });
}

function showAuth() {
  currentUser = null;
  elements.appShell.classList.add("hidden");
  elements.authScreen.classList.remove("hidden");
  showAuthMode(getUsers().length ? "login" : "signup");
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function requireAdmin() {
  if (isAdmin()) return true;
  alert("Accès refusé: seul un admin peut modifier les données.");
  return false;
}

function applyPermissions() {
  const admin = isAdmin();
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", !admin);
  });
  elements.permissionNotice.classList.toggle("hidden", admin);
  elements.appShell.classList.toggle("read-only", !admin);
}

function getRoleLabel(role) {
  return role === "admin" ? "Admin" : "Operator";
}

function updateCurrentUserFromStore() {
  if (!currentUser) return;
  const updated = getUsers().find((user) => user.id === currentUser.id);
  if (!updated) return;
  currentUser = updated;
  elements.currentRole.textContent = currentUser.role === "admin" ? "Admin - lecture/modification" : "Operator - lecture seule";
  applyPermissions();
}

function renderUsersList() {
  if (!isAdmin() || !elements.usersList) return;

  const users = getUsers();
  const adminCount = users.filter((user) => user.role === "admin").length;
  elements.usersList.replaceChildren();

  users.forEach((user) => {
    const row = document.createElement("article");
    const identity = document.createElement("div");
    const name = document.createElement("strong");
    const email = document.createElement("span");
    const meta = document.createElement("span");
    const controls = document.createElement("div");
    const select = document.createElement("select");
    const deleteButton = document.createElement("button");

    row.className = "user-row";
    identity.className = "user-identity";
    controls.className = "user-controls";
    name.textContent = user.username || "Utilisateur";
    email.textContent = user.email;
    meta.textContent = user.id === currentUser.id ? "Compte actuel" : `Créé le ${new Date(user.createdAt).toLocaleDateString("fr-FR")}`;

    select.className = "role-select";
    select.innerHTML = `
      <option value="operator">Operator - lecture seule</option>
      <option value="admin">Admin - lecture/modification</option>
    `;
    select.value = user.role;
    select.disabled = user.id === currentUser.id && user.role === "admin" && adminCount === 1;
    select.addEventListener("change", () => updateUserRole(user.id, select.value));
    deleteButton.className = "delete-user";
    deleteButton.type = "button";
    deleteButton.textContent = "Supprimer";
    deleteButton.disabled = user.role === "admin" && adminCount === 1;
    deleteButton.addEventListener("click", () => deleteUserAccount(user.id));

    identity.append(name, email, meta);
    controls.append(select, deleteButton);
    row.append(identity, controls);
    elements.usersList.append(row);
  });
}

function updateUserRole(userId, role) {
  if (!requireAdmin()) return;

  const users = getUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) return;

  const adminCount = users.filter((user) => user.role === "admin").length;
  if (target.role === "admin" && role !== "admin" && adminCount <= 1) {
    alert("Impossible de retirer le dernier compte admin.");
    renderUsersList();
    return;
  }

  const updated = users.map((user) => (user.id === userId ? { ...user, role } : user));
  saveUsers(updated);
  updateCurrentUserFromStore();
  renderUsersList();
}

function deleteUserAccount(userId) {
  if (!requireAdmin()) return;

  const users = getUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) return;

  const adminCount = users.filter((user) => user.role === "admin").length;
  if (target.role === "admin" && adminCount <= 1) {
    alert("Impossible de supprimer le dernier compte admin.");
    renderUsersList();
    return;
  }

  const label = target.username || target.email;
  const confirmed = confirm(`Supprimer le compte ${label} ?`);
  if (!confirmed) return;

  const updated = users.filter((user) => user.id !== userId);
  saveUsers(updated);

  if (userId === currentUser.id) {
    localStorage.removeItem(SESSION_KEY);
    showAuth();
    return;
  }

  renderUsersList();
}

function restoreSession() {
  const sessionId = localStorage.getItem(SESSION_KEY);
  const user = getUsers().find((item) => item.id === sessionId);
  if (user) {
    showApp(user);
    return;
  }

  showAuth();
}

function loadBoilers() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return mergeSeedBoilers([]);
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? mergeSeedBoilers(translateExampleData(normalizeBoilers(parsed))) : mergeSeedBoilers([]);
  } catch {
    return mergeSeedBoilers([]);
  }
}

function getSaunierDuvalSeedData() {
  const models = Array.isArray(globalThis.SAUNIER_DUVAL_MODELS) ? globalThis.SAUNIER_DUVAL_MODELS : [];

  return models.map((item) => {
    const source = item && typeof item === "object" ? item : { model: String(item || "") };
    const model = String(source.model || source.name || "");

    return {
      id: source.id ? `sparecheck-${source.id}` : createId(),
      manufacturer: source.manufacturer || "Saunier Duval",
      model,
      barcode: String(source.barcode || ""),
      specUrl: "",
      explodedViewUrl: getDefaultExplodedViewUrl({ manufacturer: "Saunier Duval", model }),
      notes: String(source.notes || ""),
      parts: []
    };
  });
}

function getElmLeblancSeedData() {
  const models = Array.isArray(globalThis.ELMLEBLANC_TIRAGE_NATUREL_MODELS)
    ? globalThis.ELMLEBLANC_TIRAGE_NATUREL_MODELS
    : [];

  return models.map((source) => {
    const reference = String(source.reference || "");
    const displayName = String(source.displayName || source.productTitle || reference || "");
    const model = reference && !displayName.includes(reference) ? `${displayName} (${reference})` : displayName;

    return {
      id: source.id ? `elmleblanc-${source.id}` : createId(),
      catalogueModelId: String(source.id || ""),
      manufacturer: "elm.leblanc",
      model,
      barcode: reference,
      specUrl: String(source.productUrl || ""),
      explodedViewUrl: String(source.mainDrawingUrl || ""),
      notes: "",
      parts: []
    };
  });
}

function normalizeModelKey(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function getBoilerSeedKey(boiler) {
  return `${String(boiler?.manufacturer || "").trim().toLowerCase()}|${String(boiler?.model || "").trim().toLowerCase()}`;
}

function getDeletedSeedBoilers() {
  try {
    const deleted = JSON.parse(localStorage.getItem(DELETED_SEED_BOILERS_KEY)) || [];
    return new Set(Array.isArray(deleted) ? deleted : []);
  } catch {
    return new Set();
  }
}

function saveDeletedSeedBoilers(deletedSeeds) {
  localStorage.setItem(DELETED_SEED_BOILERS_KEY, JSON.stringify([...deletedSeeds]));
}

function getDefaultExplodedViewUrl(boiler) {
  const manufacturer = String(boiler?.manufacturer || "").trim().toLowerCase();
  if (manufacturer === "elm.leblanc") {
    const modelId = String(boiler?.catalogueModelId || "").trim();
    const views = getElmLeblancExplodedViewsByModelId(modelId);
    return views[0]?.url || "";
  }

  if (manufacturer !== "saunier duval") return "";

  return EXPLODED_VIEW_URLS[normalizeModelKey(boiler?.model)] || "";
}

function getLocalExplodedViews(boiler) {
  const manufacturer = String(boiler?.manufacturer || "").trim().toLowerCase();

  if (manufacturer === "elm.leblanc") {
    return getElmLeblancExplodedViewsByModelId(boiler?.catalogueModelId);
  }

  if (manufacturer === "saunier duval") {
    const source =
      globalThis.SAUNIER_DUVAL_EXPLODED_VIEWS && typeof globalThis.SAUNIER_DUVAL_EXPLODED_VIEWS === "object"
        ? globalThis.SAUNIER_DUVAL_EXPLODED_VIEWS
        : {};
    return source[boiler?.model] || source[String(boiler?.model || "").trim()] || [];
  }

  return [];
}

function getElmLeblancExplodedViewsByModelId(modelId) {
  const source =
    globalThis.ELMLEBLANC_TIRAGE_NATUREL_EXPLODED_VIEWS &&
    typeof globalThis.ELMLEBLANC_TIRAGE_NATUREL_EXPLODED_VIEWS === "object"
      ? globalThis.ELMLEBLANC_TIRAGE_NATUREL_EXPLODED_VIEWS
      : {};
  const views = source[String(modelId || "")] || [];

  return views.map((view, index) => ({
    name: view.title || `Vue ${index + 1}`,
    displayType: view.level === "root" ? "Vue d'ensemble" : "Sous-ensemble",
    documentId: view.pdf || "",
    componentId: view.position || "",
    component: view.title || "",
    externalUrl: view.url || "",
    pdf: view.pdf || ""
  }));
}

function getDocumentAssetUrl(blobId) {
  if (!blobId) return "";
  const inPackagedFolder = window.location.pathname.includes("/BoilerCore-EGS-ENERGIES/");
  const prefix = inPackagedFolder ? "../" : "";
  return `${prefix}assets/sparecheck-documents/${blobId}.webp`;
}

function getSaunierDuvalPartsByModel() {
  const source =
    globalThis.SAUNIER_DUVAL_PARTS_BY_MODEL && typeof globalThis.SAUNIER_DUVAL_PARTS_BY_MODEL === "object"
      ? globalThis.SAUNIER_DUVAL_PARTS_BY_MODEL
      : {};
  const normalized = new Map();

  Object.entries(source).forEach(([model, parts]) => {
    if (!Array.isArray(parts)) return;

    normalized.set(
      normalizeModelKey(model),
      parts.map((part) => ({
        name: String(part.name || ""),
        number: String(part.number || ""),
        dispart: String(part.dispart || ""),
        pex: String(part.pex || ""),
        category: String(part.category || part.source || "Catalogue Saunier Duval"),
        position: String(part.position || ""),
        component: String(part.component || ""),
        componentId: String(part.componentId || ""),
        documentId: String(part.documentId || ""),
        description: String(part.description || ""),
        ean: String(part.ean || ""),
        replacedBy: String(part.replacedBy || ""),
        source: String(part.source || "")
      }))
    );
  });

  if (Array.isArray(globalThis.PIECESXPRESS_DUOMAX_CONDENS_F30_90_1_PARTS)) {
    normalized.set(
      normalizeModelKey("DUOMAX CONDENS F30 90.1"),
      globalThis.PIECESXPRESS_DUOMAX_CONDENS_F30_90_1_PARTS.map((part) => ({
        name: String(part.name || ""),
        number: String(part.number || ""),
        dispart: "",
        pex: String(part.pex || ""),
        category: "Pièces PiecesXpress"
      }))
    );
  }

  return normalized;
}

function getElmLeblancPartsByModel() {
  const source =
    globalThis.ELMLEBLANC_TIRAGE_NATUREL_PARTS_BY_MODEL &&
    typeof globalThis.ELMLEBLANC_TIRAGE_NATUREL_PARTS_BY_MODEL === "object"
      ? globalThis.ELMLEBLANC_TIRAGE_NATUREL_PARTS_BY_MODEL
      : {};
  const normalized = new Map();

  Object.entries(source).forEach(([modelId, modelParts]) => {
    const sections = Array.isArray(modelParts?.sections) ? modelParts.sections : [];
    const parts = sections.flatMap((section) => {
      const component = String(section.title || "");
      return (section.parts || []).map((part) => ({
        name: String(part.label || "").replace(/^\s*\d+\s*\.\s*/, ""),
        number: String(part.reference || ""),
        dispart: "",
        pex: "",
        category: component || "Catalogue elm.leblanc",
        position: String(part.position || ""),
        component,
        componentId: String(section.position || ""),
        documentId: String(section.picture || ""),
        description: String(part.label || ""),
        ean: "",
        replacedBy: "",
        source: "Catalogue elm.leblanc"
      }));
    });

    normalized.set(String(modelId), parts);
  });

  return normalized;
}

function mergeSeedBoilers(boilers) {
  const normalized = normalizeBoilers(boilers);
  const existingKeys = new Set(normalized.map(getBoilerSeedKey));
  const deletedSeedKeys = getDeletedSeedBoilers();
  const seedData = [...saunierDuvalSeedData, ...elmLeblancSeedData];
  const missingSeeds = seedData.filter((boiler) => {
    const key = getBoilerSeedKey(boiler);
    return !existingKeys.has(key) && !deletedSeedKeys.has(key);
  });
  const merged = clearNotesOnce(mergeElmLeblancPartsOnce(mergeSaunierDuvalPartsOnce(normalizeBoilers([...normalized, ...missingSeeds]))));

  return merged;
}

function mergeSaunierDuvalPartsOnce(boilers) {
  if (!saunierDuvalPartsByModel.size) return boilers;

  let changed = false;
  const updated = boilers.map((boiler) => {
    if (boiler.manufacturer.trim().toLowerCase() !== "saunier duval") return boiler;

    const seedParts = saunierDuvalPartsByModel.get(normalizeModelKey(boiler.model));
    if (!seedParts?.length) return boiler;

    const existingParts = boiler.parts || [];
    const existingKeys = new Set(existingParts.map(getPartSyncKey));
    const missingParts = seedParts.filter((part) => !existingKeys.has(getPartSyncKey(part)));

    if (!missingParts.length) return boiler;
    changed = true;

    return {
      ...boiler,
      specUrl: boiler.specUrl || "https://www.dispart.fr",
      explodedViewUrl: boiler.explodedViewUrl || getDefaultExplodedViewUrl(boiler),
      notes: boiler.notes || "",
      parts: [...(boiler.parts || []), ...missingParts]
    };
  });

  updated.changed = changed;
  localStorage.setItem(SAUNIER_PARTS_IMPORT_KEY, `synced-${Date.now()}`);
  return updated;
}

function mergeElmLeblancPartsOnce(boilers) {
  if (!elmLeblancPartsByModel.size) return boilers;

  let changed = false;
  const updated = boilers.map((boiler) => {
    if (boiler.manufacturer.trim().toLowerCase() !== "elm.leblanc") return boiler;

    const seedParts = elmLeblancPartsByModel.get(String(boiler.catalogueModelId || ""));
    if (!seedParts?.length) return boiler;

    const existingParts = boiler.parts || [];
    const existingKeys = new Set(existingParts.map(getPartSyncKey));
    const missingParts = seedParts.filter((part) => !existingKeys.has(getPartSyncKey(part)));

    if (!missingParts.length) return boiler;
    changed = true;

    return {
      ...boiler,
      specUrl: boiler.specUrl || "",
      explodedViewUrl: boiler.explodedViewUrl || getDefaultExplodedViewUrl(boiler),
      notes: boiler.notes || "",
      parts: [...(boiler.parts || []), ...missingParts]
    };
  });

  updated.changed = changed;
  localStorage.setItem(ELMLEBLANC_PARTS_IMPORT_KEY, `synced-${Date.now()}`);
  return updated;
}

function getPartSyncKey(part) {
  return [
    part.number,
    part.component || part.category,
    part.position,
    part.description,
    part.ean,
    part.replacedBy
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function clearNotesOnce(boilers) {
  if (localStorage.getItem(NOTES_CLEAR_KEY)) return boilers;

  const updated = boilers.map((boiler) => (boiler.notes ? { ...boiler, notes: "" } : boiler));
  const changed = updated.some((boiler, index) => boiler.notes !== boilers[index].notes);
  updated.changed = Boolean(boilers.changed || changed);
  localStorage.setItem(NOTES_CLEAR_KEY, "done");

  return updated;
}

function normalizeBoilers(boilers) {
  return boilers
    .filter((boiler) => boiler && typeof boiler === "object")
    .map((boiler) => ({
      id: boiler.id || createId(),
      manufacturer: String(boiler.manufacturer || ""),
      model: String(boiler.model || ""),
      catalogueModelId: String(boiler.catalogueModelId || ""),
      barcode: String(boiler.barcode || ""),
      specUrl: String(boiler.specUrl || ""),
      explodedViewUrl: String(boiler.explodedViewUrl || getDefaultExplodedViewUrl(boiler)),
      notes: String(boiler.notes || ""),
      parts: Array.isArray(boiler.parts)
        ? boiler.parts
            .filter((part) => part && typeof part === "object")
            .map((part) => ({
              name: String(part.name || ""),
              number: String(part.number || ""),
              category: String(part.category || ""),
              dispart: String(part.dispart || ""),
              pex: String(part.pex || ""),
              position: String(part.position || ""),
              component: String(part.component || ""),
              componentId: String(part.componentId || ""),
              documentId: String(part.documentId || ""),
              description: String(part.description || ""),
              ean: String(part.ean || ""),
              replacedBy: String(part.replacedBy || ""),
              source: String(part.source || "")
            }))
        : []
    }));
}

function ensureStarterModels(boilers) {
  if (!boilers.length) return boilers;

  const hasThemaPlus25 = boilers.some(
    (boiler) =>
      boiler.manufacturer.toLowerCase() === "saunier duval" &&
      boiler.model.toLowerCase() === "thema plus 25"
  );

  if (hasThemaPlus25) return boilers;

  const themaPlus25 = sampleData.find((boiler) => boiler.model === "Thema plus 25");
  const updated = normalizeBoilers([...boilers, { ...themaPlus25, id: createId(), parts: [] }]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

function translateExampleData(boilers) {
  const translations = {
    "Example record. Replace or delete when you add your own database.":
      "Exemple de fiche. Remplacez-la ou supprimez-la quand vous ajoutez votre propre base.",
    "Example record.": "Exemple de fiche.",
    "Ignition electrode": "Électrode d'allumage",
    "Diverter valve cartridge": "Cartouche de vanne trois voies",
    "Fan assembly": "Ensemble ventilateur",
    "Pressure relief valve": "Soupape de sécurité",
    "Flow turbine adapter": "Adaptateur de turbine de débit",
    "Ignition": "Allumage",
    "Hydraulics": "Hydraulique",
    "Safety": "Sécurité",
    "Water": "Eau"
  };

  return boilers.map((boiler) => ({
    ...boiler,
    barcode: boiler.barcode || "",
    specUrl: boiler.specUrl || "",
    notes: translations[boiler.notes] || boiler.notes,
    parts: (boiler.parts || []).map((part) => ({
      ...part,
      name: translations[part.name] || part.name,
      category: translations[part.category] || part.category
    }))
  }));
}

function saveBoilers() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.boilers));
  } catch (error) {
    console.warn("Catalogue trop volumineux pour le stockage navigateur; utilisation en memoire uniquement.", error);
  }
}

function addPartRow(part = {}) {
  if (currentUser && !isAdmin()) return;
  const row = elements.partRowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".part-name").value = part.name || "";
  row.querySelector(".part-number").value = part.number || "";
  row.querySelector(".part-category").value = part.category || "";
  row.querySelector(".remove-part").addEventListener("click", () => {
    if (elements.partsList.children.length > 1) {
      const confirmed = confirm("Supprimer cette pièce ?");
      if (!confirmed) return;
      row.remove();
    }
  });
  elements.partsList.append(row);
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  elements.partsList.replaceChildren();
  addPartRow();
  elements.saveModel.textContent = "Enregistrer le modèle";
  elements.cancelEdit.classList.add("hidden");
}

function getPartsFromForm() {
  return [...elements.partsList.querySelectorAll(".part-row")]
    .map((row) => ({
      name: row.querySelector(".part-name").value.trim(),
      number: row.querySelector(".part-number").value.trim(),
      category: row.querySelector(".part-category").value.trim()
    }))
    .filter((part) => part.name && part.number);
}

function matchesQuery(boiler, query) {
  if (!query) return true;

  const searchable = [
    boiler.manufacturer,
    boiler.model,
    boiler.barcode,
    boiler.specUrl,
    boiler.explodedViewUrl,
    boiler.notes,
    ...(boiler.parts || []).flatMap((part) => [part.name, part.number, part.category, part.dispart, part.pex])
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(query.toLowerCase());
}

function getPartSource(part) {
  if (String(part.source || "").toLowerCase().includes("elm.leblanc")) return "elmleblanc";
  if (part.dispart) return "dispart";
  if (part.pex) return "piecesxpress";
  return "manual";
}

function getSourceLabel(source) {
  if (source === "dispart") return "Dispart";
  if (source === "piecesxpress") return "PiecesXpress";
  if (source === "elmleblanc") return "elm.leblanc";
  return "Saisie manuelle";
}

function getBoilerSources(boiler) {
  return [...new Set((boiler.parts || []).map(getPartSource))];
}

function getBoilerStatus(boiler) {
  return (boiler.parts || []).length ? "complete" : "missing";
}

function getStatusLabel(status) {
  return status === "complete" ? "Complet" : "Pièces manquantes";
}

function matchesFilters(boiler) {
  const manufacturer = String(boiler.manufacturer || "").trim().toLowerCase();

  if (state.manufacturerFilter && manufacturer !== state.manufacturerFilter) return false;

  return true;
}

function sortBoilers(boilers) {
  const sorted = [...boilers];
  const alpha = (a, b, field) =>
    String(a[field] || "").localeCompare(String(b[field] || ""), "fr", { sensitivity: "base" });

  if (state.sortMode === "model") {
    return sorted.sort((a, b) => alpha(a, b, "model") || alpha(a, b, "manufacturer"));
  }

  if (state.sortMode === "parts") {
    return sorted.sort((a, b) => (b.parts || []).length - (a.parts || []).length || alpha(a, b, "manufacturer"));
  }

  if (state.sortMode === "recent") {
    return sorted.reverse();
  }

  return sorted.sort((a, b) => alpha(a, b, "manufacturer") || alpha(a, b, "model"));
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr", { sensitivity: "base" })
  );
}

function populateSelect(select, values, fallbackLabel, selectedValue) {
  select.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = fallbackLabel;
  select.append(defaultOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value.toLowerCase();
    option.textContent = value;
    select.append(option);
  });

  select.value = selectedValue;
}

function renderFilters() {
  const manufacturers = uniqueSorted(state.boilers.map((boiler) => boiler.manufacturer));

  populateSelect(elements.manufacturerFilter, manufacturers, "Tous les fabricants", state.manufacturerFilter);
  elements.sortMode.value = state.sortMode;
}

function renderResults() {
  renderFilters();
  const hasSearch = Boolean(state.query.trim());
  const filtered = hasSearch
    ? sortBoilers(state.boilers.filter((boiler) => matchesQuery(boiler, state.query) && matchesFilters(boiler)))
    : [];
  elements.results.replaceChildren();
  renderMetrics();

  if (!hasSearch) {
    elements.resultsSummary.textContent = `${state.boilers.length} modèles disponibles`;
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Saisissez un nom de modèle, une référence ou un numéro de série pour afficher les appareils.";
    elements.results.append(empty);
    return;
  }

  elements.resultsSummary.textContent =
    filtered.length === 1 ? "1 modèle de chaudière trouvé" : `${filtered.length} modèles de chaudière trouvés`;

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucun modèle de chaudière trouvé. Ajoutez-le à droite ou importez votre base.";
    elements.results.append(empty);
    return;
  }

  filtered.forEach((boiler) => elements.results.append(createBoilerCard(boiler)));
}
function renderMetrics() {
  const modelCount = state.boilers.length;
  const partCount = state.boilers.reduce((total, boiler) => total + (boiler.parts || []).length, 0);
  const completeCount = state.boilers.filter((boiler) => getBoilerStatus(boiler) === "complete").length;
  const manufacturerCount = new Set(
    state.boilers.map((boiler) => String(boiler.manufacturer || "").trim().toLowerCase()).filter(Boolean)
  ).size;

  elements.totalModels.textContent = modelCount;
  elements.metricModels.textContent = modelCount;
  elements.metricParts.textContent = partCount;
  elements.metricManufacturers.textContent = manufacturerCount;
  elements.metricComplete.textContent = completeCount;
  elements.metricMissing.textContent = modelCount - completeCount;
}

function createBadge(label, type) {
  const badge = document.createElement("span");
  badge.className = `status-badge ${type}`;
  badge.textContent = label;
  return badge;
}

function createBoilerCard(boiler) {
  const card = document.createElement("article");
  card.className = "boiler-card";

  const header = document.createElement("header");
  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  const manufacturer = document.createElement("p");
  const notes = document.createElement("p");
  const meta = document.createElement("p");
  const badgeRow = document.createElement("div");
  const buttonGroup = document.createElement("div");
  const partsToggle = document.createElement("button");
  const detailButton = document.createElement("button");
  const explodedViewButton = document.createElement("button");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const localExplodedViews = getLocalExplodedViews(boiler);

  title.textContent = boiler.model;
  manufacturer.className = "manufacturer";
  manufacturer.textContent = boiler.manufacturer;
  meta.className = "model-meta";
  meta.textContent = [
    boiler.barcode ? `Code-barres: ${boiler.barcode}` : "",
    localExplodedViews.length ? `${localExplodedViews.length} vues \u00e9clat\u00e9es disponibles` : boiler.explodedViewUrl ? "Vue \u00e9clat\u00e9e disponible" : ""
  ]
    .filter(Boolean)
    .join(" · ");
  notes.className = "notes";
  notes.textContent = boiler.notes || "";
  badgeRow.className = "badge-row";
  buttonGroup.className = "card-actions";
  partsToggle.className = "parts-toggle";
  partsToggle.type = "button";
  partsToggle.setAttribute("aria-expanded", "false");
  partsToggle.textContent =
    boiler.parts.length === 1 ? "Voir 1 pièce" : boiler.parts.length ? `Voir ${boiler.parts.length} pièces` : "Pièces à compléter";
  detailButton.className = "detail-model";
  detailButton.type = "button";
  detailButton.textContent = "Détail";
  detailButton.addEventListener("click", () => openDetail(boiler.id));
  explodedViewButton.className = "exploded-view-model";
  explodedViewButton.type = "button";
  explodedViewButton.textContent = localExplodedViews.length > 1 ? "Vues \u00e9clat\u00e9es" : "Vue \u00e9clat\u00e9e";
  explodedViewButton.disabled = !localExplodedViews.length && !boiler.explodedViewUrl;
  explodedViewButton.addEventListener("click", () => openExplodedView(boiler));
  editButton.className = "edit-model";
  editButton.type = "button";
  editButton.textContent = "Modifier";
  editButton.addEventListener("click", () => editBoiler(boiler.id));
  deleteButton.className = "delete-model";
  deleteButton.type = "button";
  deleteButton.textContent = "Supprimer";
  deleteButton.addEventListener("click", () => deleteBoiler(boiler.id));
  badgeRow.append(createBadge(getStatusLabel(getBoilerStatus(boiler)), getBoilerStatus(boiler)));
  getBoilerSources(boiler).forEach((source) => badgeRow.append(createBadge(getSourceLabel(source), source)));
  buttonGroup.append(detailButton, partsToggle, explodedViewButton);
  if (isAdmin()) {
    buttonGroup.append(editButton, deleteButton);
  }

  titleBlock.append(title, manufacturer);
  titleBlock.append(badgeRow);
  if (meta.textContent) titleBlock.append(meta);
  if (boiler.notes) titleBlock.append(notes);
  header.append(titleBlock, buttonGroup);

  const table = document.createElement("table");
  table.className = "parts-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nom de la pièce</th>
        <th>Numéro de pièce</th>
        <th>Catégorie</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  if (!boiler.parts.length) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="3" class="empty-parts"></td>
    `;
    row.children[0].textContent = "Pièces à compléter";
    tbody.append(row);
  }

  boiler.parts.forEach((part) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td></td>
      <td class="part-number-cell"></td>
      <td></td>
    `;
    row.children[0].textContent = part.name;
    row.children[1].textContent = part.number;
    if (part.dispart) {
      const dispart = document.createElement("small");
      dispart.className = "dispart-ref";
      dispart.textContent = `Dispart: ${part.dispart}`;
      row.children[1].append(dispart);
    }
    if (part.pex) {
      const pex = document.createElement("small");
      pex.className = "dispart-ref";
      pex.textContent = `PEX: ${part.pex}`;
      row.children[1].append(pex);
    }
    row.children[2].textContent = part.category || "Général";
    tbody.append(row);
  });

  const partsPanel = document.createElement("div");
  partsPanel.className = "parts-panel hidden";
  partsPanel.append(table);

  partsToggle.addEventListener("click", () => {
    const isOpen = partsToggle.getAttribute("aria-expanded") === "true";
    const nextOpen = !isOpen;
    partsToggle.setAttribute("aria-expanded", String(nextOpen));
    partsToggle.textContent = nextOpen
      ? "Masquer les pièces"
      : boiler.parts.length === 1
        ? "Voir 1 pièce"
        : boiler.parts.length
          ? `Voir ${boiler.parts.length} pièces`
          : "Pièces à compléter";
    partsPanel.classList.toggle("hidden", !nextOpen);
  });

  card.append(header, partsPanel);
  return card;
}

function createDetailPartRow(part) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td></td>
    <td class="part-number-cell"></td>
    <td></td>
  `;

  const copyButton = document.createElement("button");
  copyButton.className = "copy-reference";
  copyButton.type = "button";
  copyButton.textContent = part.number;
  copyButton.title = "Copier la référence";
  copyButton.addEventListener("click", () => copyPartReference(copyButton, part.number));

  row.children[0].textContent = part.name;
  row.children[1].append(copyButton);
  if (part.position || part.component || part.ean || part.replacedBy || part.description) {
    const details = document.createElement("small");
    details.className = "dispart-ref";
    details.textContent = [part.position ? `Pos. ${part.position}` : "", part.component, part.ean ? `EAN ${part.ean}` : "", part.replacedBy ? `Remplacée par ${part.replacedBy}` : "", part.description]
      .filter(Boolean)
      .join(" · ");
    row.children[1].append(details);
  }
  row.children[2].textContent = part.source || getSourceLabel(getPartSource(part));
  return row;
}

async function copyPartReference(button, reference) {
  const value = String(reference || "").trim();
  if (!value) return;

  const previousText = button.textContent;

  try {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        fallbackCopyText(value);
      }
    } else {
      fallbackCopyText(value);
    }

    button.textContent = "Copié";
    button.classList.add("copied");
    window.setTimeout(() => {
      button.textContent = previousText;
      button.classList.remove("copied");
    }, 900);
  } catch {
    button.textContent = previousText;
  }
}

function fallbackCopyText(value) {
  const input = document.createElement("input");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}
function matchesPartDetail(part, query) {
  if (!query) return true;

  const sourceText = [
    part.name,
    part.number,
    part.category,
    part.component,
    part.position,
    part.description,
    part.ean,
    part.replacedBy,
    getSourceLabel(getPartSource(part)),
    part.dispart,
    part.pex
  ]
    .join(" ")
    .toLowerCase();

  return sourceText.includes(query.toLowerCase());
}

function renderDetailParts(tbody, parts, query) {
  tbody.replaceChildren();

  const matchingParts = parts.filter((part) => matchesPartDetail(part, query));

  if (matchingParts.length) {
    matchingParts.forEach((part) => tbody.append(createDetailPartRow(part)));
    return;
  }

  const empty = document.createElement("tr");
  empty.innerHTML = `<td colspan="3" class="empty-parts"></td>`;
  empty.children[0].textContent = parts.length ? "Aucune pièce ne correspond à la recherche." : "Pièces à compléter";
  tbody.append(empty);
}

function openDetail(id) {
  const boiler = state.boilers.find((item) => item.id === id);
  if (!boiler) return;

  elements.detailTitle.textContent = `${boiler.manufacturer} ${boiler.model}`;
  elements.detailContent.replaceChildren();

  const summary = document.createElement("div");
  summary.className = "detail-summary";
  summary.append(createBadge(getStatusLabel(getBoilerStatus(boiler)), getBoilerStatus(boiler)));
  getBoilerSources(boiler).forEach((source) => summary.append(createBadge(getSourceLabel(source), source)));

  const detailActions = document.createElement("div");
  detailActions.className = "detail-actions";

  const stats = document.createElement("p");
  stats.className = "detail-stat";
  stats.textContent = `${boiler.parts.length} pièce${boiler.parts.length > 1 ? "s" : ""} référencée${boiler.parts.length > 1 ? "s" : ""}`;
  detailActions.append(stats);

  const views = getLocalExplodedViews(boiler);
  if (views.length || boiler.explodedViewUrl) {
    const explodedButton = document.createElement("button");
    explodedButton.type = "button";
    explodedButton.className = "detail-exploded-link";
    explodedButton.textContent = views.length > 1 ? `Voir ${views.length} vues éclatées` : "Voir la vue éclatée";
    explodedButton.addEventListener("click", () => openExplodedView(boiler));
    detailActions.append(explodedButton);
  }

  const searchLabel = document.createElement("label");
  searchLabel.className = "detail-search";
  searchLabel.textContent = "Recherche pièces";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Nom, référence, source, code...";
  searchInput.autocomplete = "off";
  searchLabel.append(searchInput);

  const table = document.createElement("table");
  table.className = "parts-table detail-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Nom de la pièce</th>
        <th>Référence</th>
        <th>Source</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  renderDetailParts(tbody, boiler.parts, "");
  searchInput.addEventListener("input", (event) => {
    renderDetailParts(tbody, boiler.parts, event.target.value.trim());
  });

  elements.detailContent.append(summary, detailActions, searchLabel, table);
  elements.detailModal.classList.remove("hidden");
  searchInput.focus();
}

function closeDetail() {
  elements.detailModal.classList.add("hidden");
  elements.detailContent.replaceChildren();
}

function editBoiler(id) {
  if (!requireAdmin()) return;
  const boiler = state.boilers.find((item) => item.id === id);
  if (!boiler) return;

  state.editingId = id;
  elements.manufacturer.value = boiler.manufacturer;
  elements.model.value = boiler.model;
  elements.barcode.value = boiler.barcode || "";
  if (elements.specUrl) elements.specUrl.value = boiler.specUrl || "";
  elements.explodedViewUrl.value = boiler.explodedViewUrl || getDefaultExplodedViewUrl(boiler);
  elements.notes.value = boiler.notes || "";
  elements.partsList.replaceChildren();

  if (boiler.parts.length) {
    boiler.parts.forEach((part) => addPartRow(part));
  } else {
    addPartRow();
  }

  elements.saveModel.textContent = "Enregistrer les modifications";
  elements.cancelEdit.classList.remove("hidden");
  elements.manufacturer.focus();
  document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openExplodedView(boiler) {
  const views = getLocalExplodedViews(boiler);
  if (!views.length) {
    const explodedViewUrl = boiler.explodedViewUrl || getDefaultExplodedViewUrl(boiler);
    if (!explodedViewUrl) {
      alert("Aucun lien de vue \u00e9clat\u00e9e n'est enregistr\u00e9 pour ce mod\u00e8le.");
      return;
    }

    window.open(explodedViewUrl, "_blank", "noopener");
    return;
  }

  elements.detailTitle.textContent = `Vues \u00e9clat\u00e9es - ${boiler.model}`;
  elements.detailContent.replaceChildren();

  const viewer = document.createElement("div");
  viewer.className = "exploded-viewer";

  const list = document.createElement("div");
  list.className = "exploded-view-list";

  const stage = document.createElement("div");
  stage.className = "exploded-view-stage";

  const imageWrap = document.createElement("div");
  imageWrap.className = "exploded-image-wrap";

  const image = document.createElement("img");
  image.className = "exploded-image";
  image.alt = "";

  const externalFrame = document.createElement("iframe");
  externalFrame.className = "exploded-pdf-frame";
  externalFrame.title = "Vue eclatee PDF";
  externalFrame.loading = "lazy";

  const externalLink = document.createElement("a");
  externalLink.className = "exploded-pdf-link";
  externalLink.target = "_blank";
  externalLink.rel = "noopener";
  externalLink.textContent = "Ouvrir le PDF";

  const hotspotLayer = document.createElement("div");
  hotspotLayer.className = "hotspot-layer";
  imageWrap.append(image, externalFrame, externalLink, hotspotLayer);

  const title = document.createElement("h3");
  const meta = document.createElement("p");
  meta.className = "exploded-view-meta";
  const referencePanel = document.createElement("div");
  referencePanel.className = "exploded-reference-panel";
  stage.append(title, meta, imageWrap, referencePanel);

  function renderView(view, index) {
    [...list.querySelectorAll("button")].forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === index);
    });
    title.textContent = view.name || "Vue \u00e9clat\u00e9e";
    meta.textContent = [
      view.displayType ? `Type: ${view.displayType}` : "",
      view.documentId ? `Document: ${view.documentId}` : "",
      view.externalUrl ? "PDF catalogue" : "",
      view.hotpoints?.length ? `${view.hotpoints.length} rep\u00e8res pi\u00e8ces` : ""
    ]
      .filter(Boolean)
      .join(" · ");
    const hasLocalImage = Boolean(view.imageBlobId);
    image.hidden = !hasLocalImage;
    hotspotLayer.hidden = !hasLocalImage;
    externalFrame.hidden = hasLocalImage || !view.externalUrl;
    externalLink.hidden = !view.externalUrl;
    if (hasLocalImage) {
      image.src = getDocumentAssetUrl(view.imageBlobId);
      image.alt = `${boiler.model} - ${view.name || "Vue \u00e9clat\u00e9e"}`;
    } else {
      image.removeAttribute("src");
      image.alt = "";
    }
    if (view.externalUrl) {
      externalFrame.src = view.externalUrl;
      externalLink.href = view.externalUrl;
    } else {
      externalFrame.removeAttribute("src");
      externalLink.removeAttribute("href");
    }
    hotspotLayer.replaceChildren();
    referencePanel.replaceChildren();
    (view.hotpoints || []).slice(0, 220).forEach((hotpoint) => {
      const marker = document.createElement("button");
      marker.className = "hotspot-marker";
      marker.type = "button";
      marker.textContent = hotpoint.content;
      marker.title = hotpoint.content;
      marker.style.left = `${hotpoint.x * 100}%`;
      marker.style.top = `${hotpoint.y * 100}%`;
      marker.style.width = `${Math.max(hotpoint.w * 100, 2.4)}%`;
      marker.style.height = `${Math.max(hotpoint.h * 100, 2.4)}%`;
      marker.addEventListener("click", async () => {
        await copyHotpointReference(marker, hotpoint.content);
      });
      hotspotLayer.append(marker);
    });

    const references = getExplodedViewReferences(boiler, view);
    if (references.length) {
      const referenceTitle = document.createElement("h4");
      referenceTitle.textContent = "R\u00e9f\u00e9rences de cette vue";
      const referenceGrid = document.createElement("div");
      referenceGrid.className = "exploded-reference-grid";
      references.forEach((reference) => {
        const refButton = document.createElement("button");
        refButton.type = "button";
        refButton.className = "exploded-reference-button";
        refButton.textContent = reference.number;
        refButton.title = reference.name ? `${reference.number} - ${reference.name}` : reference.number;
        refButton.addEventListener("click", async () => {
          await copyHotpointReference(refButton, reference.number);
        });
        referenceGrid.append(refButton);
      });
      referencePanel.append(referenceTitle, referenceGrid);
    }
  }

  views.forEach((view, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "exploded-view-item";
    const thumb = view.thumbnailBlobId || view.imageBlobId ? document.createElement("img") : document.createElement("span");
    if (thumb.tagName === "IMG") {
      thumb.src = getDocumentAssetUrl(view.thumbnailBlobId || view.imageBlobId);
      thumb.alt = "";
    } else {
      thumb.className = "exploded-pdf-thumb";
      thumb.textContent = "PDF";
    }
    const label = document.createElement("span");
    label.textContent = view.name || `Vue ${index + 1}`;
    item.append(thumb, label);
    item.addEventListener("click", () => renderView(view, index));
    list.append(item);
  });

  viewer.append(list, stage);
  elements.detailContent.append(viewer);
  elements.detailModal.classList.remove("hidden");
  renderView(views[0], 0);
}

function getExplodedViewReferences(boiler, view) {
  const references = new Map();
  (view.hotpoints || []).forEach((hotpoint) => {
    const number = String(hotpoint.content || "").trim();
    if (number) references.set(number.toLowerCase(), { number, name: "" });
  });
  (boiler.parts || [])
    .filter((part) => {
      const rootElmView = view.externalUrl && view.displayType === "Vue d'ensemble";
      const sameDocument = view.documentId && part.documentId === view.documentId;
      const sameComponent = view.componentId && part.componentId === view.componentId;
      const sameComponentName = view.name && part.component === view.name;
      return rootElmView || sameDocument || sameComponent || sameComponentName;
    })
    .forEach((part) => {
      const number = String(part.number || "").trim();
      if (!number) return;
      references.set(number.toLowerCase(), { number, name: part.name || "" });
    });
  return [...references.values()].sort((a, b) => a.number.localeCompare(b.number, "fr", { numeric: true }));
}

async function copyHotpointReference(button, reference) {
  const value = String(reference || "").trim();
  if (!value) return;

  const previousText = button.textContent;
  try {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        fallbackCopyText(value);
      }
    } else {
      fallbackCopyText(value);
    }
    button.textContent = "Copié";
    button.classList.add("copied");
    window.setTimeout(() => {
      button.textContent = previousText;
      button.classList.remove("copied");
    }, 900);
  } catch {
    button.textContent = previousText;
  }
}

function normalizeScanValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function extractDigitSequences(value) {
  return String(value || "").match(/\d{8,}/g) || [];
}

function getModelSerialRange(model) {
  const normalized = String(model || "").replace(/\s+/g, " ");
  const match = normalized.match(/\bde\s*(\d{8,})\s*(?:à|a|-)\s*(\d{8,})\b/i);
  if (!match) return null;

  return {
    start: Number(match[1]),
    end: Number(match[2])
  };
}

function isSerialInModelRange(model, serial) {
  const range = getModelSerialRange(model);
  const value = Number(serial);
  return Boolean(range && Number.isFinite(value) && value >= range.start && value <= range.end);
}

function findBoilerByScan(code) {
  const cleanCode = normalizeScanValue(code);
  if (!cleanCode) return null;

  const exactMatch = state.boilers.find((boiler) => {
    const values = [
      boiler.barcode,
      boiler.model,
      boiler.manufacturer,
      ...boiler.parts.flatMap((part) => [part.number, part.name])
    ];

    return values.some((value) => normalizeScanValue(value) === cleanCode);
  });
  if (exactMatch) return exactMatch;

  const serials = extractDigitSequences(code);
  const rangeMatch = state.boilers.find((boiler) => serials.some((serial) => isSerialInModelRange(boiler.model, serial)));
  if (rangeMatch) return rangeMatch;

  return state.boilers.find((boiler) => {
    const modelKey = normalizeScanValue(`${boiler.manufacturer} ${boiler.model}`);
    const shortModelKey = normalizeScanValue(boiler.model);
    return (shortModelKey.length >= 8 && cleanCode.includes(shortModelKey)) || modelKey.includes(cleanCode);
  });
}

function handleScannedCode(code) {
  const cleanCode = String(code || "").trim();
  if (!cleanCode) {
    elements.scannerStatus.textContent = "Saisissez ou scannez une référence.";
    return;
  }

  const boiler = findBoilerByScan(cleanCode);
  stopScanner();
  elements.search.value = boiler ? boiler.model : cleanCode;
  state.query = boiler ? boiler.model : cleanCode;
  renderResults();

  if (!boiler) {
    alert(`Aucun modèle trouvé pour: ${cleanCode}`);
    return;
  }

  openDetail(boiler.id);
}


function getScannerFrameCanvas() {
  if (!elements.cameraPreview.videoWidth || !elements.cameraPreview.videoHeight) return null;

  const canvas = document.createElement("canvas");
  canvas.width = elements.cameraPreview.videoWidth;
  canvas.height = elements.cameraPreview.videoHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(elements.cameraPreview, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function scanPlateText() {
  if (scannerOcrActive) return;
  if (!scannerStream) {
    elements.scannerStatus.textContent = "Ouvrez la caméra avant de lire la plaque.";
    return;
  }

  const canvas = getScannerFrameCanvas();
  if (!canvas) {
    elements.scannerStatus.textContent = "Image caméra pas encore prÃªte. Réessayez dans une seconde.";
    return;
  }

  if (!globalThis.Tesseract?.recognize) {
    elements.scannerStatus.textContent = "Lecture texte indisponible. Vérifiez la connexion internet puis réessayez.";
    return;
  }

  scannerOcrActive = true;
  elements.ocrScan.disabled = true;
  elements.scannerStatus.textContent = "Lecture du texte de la plaque...";

  try {
    const result = await globalThis.Tesseract.recognize(canvas, "fra+eng", {
      logger: (progress) => {
        if (progress.status === "recognizing text" && Number.isFinite(progress.progress)) {
          elements.scannerStatus.textContent = `Lecture texte ${Math.round(progress.progress * 100)}%...`;
        }
      }
    });
    const text = result?.data?.text?.trim();
    if (!text) {
      elements.scannerStatus.textContent = "Aucun texte lisible. Rapprochez la plaque et réessayez.";
      return;
    }

    elements.manualBarcode.value = text.replace(/\s+/g, " ").trim();
    handleScannedCode(text);
  } catch {
    elements.scannerStatus.textContent = "Lecture texte impossible. Essayez avec une image plus nette.";
  } finally {
    scannerOcrActive = false;
    elements.ocrScan.disabled = false;
  }
}

async function startScanner() {
  elements.scannerModal.classList.remove("hidden");
  elements.scannerStatus.textContent = "Demande d'accès à la caméra...";


  if (!navigator.mediaDevices?.getUserMedia) {
    elements.scannerStatus.textContent =
      "La caméra n'est pas disponible depuis cette page. Ouvrez l'application via HTTPS ou un serveur local.";
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    elements.cameraPreview.srcObject = scannerStream;

    if (!("BarcodeDetector" in window)) {
      elements.scannerStatus.textContent =
        "Camera ouverte. Le code-barres automatique n'est pas disponible, utilisez Lire le texte de la plaque.";
      return;
    }

    const detector = new BarcodeDetector({
      formats: ["aztec", "code_128", "code_39", "code_93", "codabar", "data_matrix", "ean_13", "ean_8", "itf", "pdf417", "qr_code", "upc_a", "upc_e"]
    });

    elements.scannerStatus.textContent = "Recherche du code-barres ou QR code...";
    scannerTimer = window.setInterval(async () => {
      try {
        if (!elements.cameraPreview.videoWidth) return;
        const codes = await detector.detect(elements.cameraPreview);
        if (codes.length) {
          handleScannedCode(codes[0].rawValue);
        }
      } catch {
        elements.scannerStatus.textContent = "Lecture en cours. Gardez le code-barres bien cadré.";
      }
    }, 500);
  } catch {
    elements.scannerStatus.textContent =
      "Impossible d'ouvrir la caméra. Vérifiez l'autorisation caméra ou saisissez le code manuellement.";
  }
}

function stopScanner() {
  elements.scannerModal.classList.add("hidden");
  window.clearInterval(scannerTimer);
  scannerTimer = null;

  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }

  elements.cameraPreview.srcObject = null;
}

function deleteBoiler(id) {
  if (!requireAdmin()) return;
  const boiler = state.boilers.find((item) => item.id === id);
  if (!boiler) return;

  const confirmed = confirm(`Supprimer ${boiler.manufacturer} ${boiler.model} ?`);
  if (!confirmed) return;

  const seedKey = getBoilerSeedKey(boiler);
  const seedExists = saunierDuvalSeedData.some((seed) => getBoilerSeedKey(seed) === seedKey);
  if (seedExists) {
    const deletedSeeds = getDeletedSeedBoilers();
    deletedSeeds.add(seedKey);
    saveDeletedSeedBoilers(deletedSeeds);
  }

  state.boilers = state.boilers.filter((item) => item.id !== id);
  saveBoilers();
  renderResults();
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv() {
  const rows = [
    ["Fabricant", "Modèle", "Code-barres", "Lien vue éclatée", "Notes", "Nom de la pièce", "Numéro de pièce", "Catégorie", "Ref. Dispart", "Code PEX"]
  ];
  state.boilers.forEach((boiler) => {
    if (!boiler.parts.length) {
      rows.push([boiler.manufacturer, boiler.model, boiler.barcode || "", boiler.explodedViewUrl || "", boiler.notes || "", "", "", "", "", ""]);
      return;
    }

    boiler.parts.forEach((part) => {
      rows.push([
        boiler.manufacturer,
        boiler.model,
        boiler.barcode || "",
        boiler.explodedViewUrl || "",
        boiler.notes || "",
        part.name,
        part.number,
        part.category || "",
        part.dispart || "",
        part.pex || ""
      ]);
    });
  });

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function hasDuplicatePartNumbers(parts) {
  const numbers = parts.map((part) => part.number.trim().toLowerCase()).filter(Boolean);
  return new Set(numbers).size !== numbers.length;
}

function findDuplicateBoiler({ manufacturer, model, barcode }) {
  const cleanManufacturer = manufacturer.trim().toLowerCase();
  const cleanModel = model.trim().toLowerCase();
  const cleanBarcode = barcode.trim().toLowerCase();

  return state.boilers.find((boiler) => {
    if (boiler.id === state.editingId) return false;

    const sameModel =
      boiler.manufacturer.trim().toLowerCase() === cleanManufacturer &&
      boiler.model.trim().toLowerCase() === cleanModel;
    const sameBarcode = cleanBarcode && String(boiler.barcode || "").trim().toLowerCase() === cleanBarcode;

    return sameModel || sameBarcode;
  });
}

elements.addPart.addEventListener("click", () => {
  if (!requireAdmin()) return;
  addPartRow();
});

elements.cancelEdit.addEventListener("click", () => resetForm());

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireAdmin()) return;

  const parts = getPartsFromForm();
  const boilerData = {
    id: createId(),
    manufacturer: elements.manufacturer.value.trim(),
    model: elements.model.value.trim(),
    barcode: elements.barcode.value.trim(),
    specUrl: elements.specUrl?.value.trim() || "",
    explodedViewUrl: elements.explodedViewUrl.value.trim(),
    notes: elements.notes.value.trim(),
    parts
  };
  if (!boilerData.explodedViewUrl) {
    boilerData.explodedViewUrl = getDefaultExplodedViewUrl(boilerData);
  }
  const duplicate = findDuplicateBoiler(boilerData);

  if (duplicate) {
    alert(`Ce modèle ou ce code-barres existe déjà: ${duplicate.manufacturer} ${duplicate.model}.`);
    elements.model.focus();
    return;
  }

  if (hasDuplicatePartNumbers(parts)) {
    alert("Un mÃªme numéro de pièce est présent plusieurs fois dans cette fiche.");
    return;
  }

  if (state.editingId) {
    state.boilers = state.boilers.map((boiler) =>
      boiler.id === state.editingId ? { ...boilerData, id: state.editingId } : boiler
    );
  } else {
    state.boilers.push(boilerData);
  }

  saveBoilers();
  resetForm();
  renderResults();
});

function confirmSearch() {
  state.query = elements.search.value.trim();
  renderResults();
}

elements.submitSearch.addEventListener("click", () => confirmSearch());

elements.search.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  confirmSearch();
});

elements.clearSearch.addEventListener("click", () => {
  state.query = "";
  state.manufacturerFilter = "";
  state.sortMode = "manufacturer";
  elements.search.value = "";
  renderResults();
});

elements.manufacturerFilter.addEventListener("change", (event) => {
  state.manufacturerFilter = event.target.value;
  renderResults();
});

elements.sortMode.addEventListener("change", (event) => {
  state.sortMode = event.target.value;
  renderResults();
});

elements.quickBackup.addEventListener("click", () => {
  const date = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  download(`backup-boilercore-${date}.json`, JSON.stringify(state.boilers, null, 2), "application/json");
});

elements.exportJson.addEventListener("click", () => {
  download("bibliotheque-pieces-chaudieres.json", JSON.stringify(state.boilers, null, 2), "application/json");
});

elements.exportCsv.addEventListener("click", () => {
  download("bibliotheque-pieces-chaudieres.csv", toCsv(), "text/csv");
});

elements.importJson.addEventListener("change", async (event) => {
  if (!requireAdmin()) {
    event.target.value = "";
    return;
  }

  const [file] = event.target.files;
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Invalid file");
    state.boilers = imported.map((boiler) => ({
      id: boiler.id || createId(),
      manufacturer: boiler.manufacturer || "",
      model: boiler.model || "",
      catalogueModelId: boiler.catalogueModelId || "",
      barcode: boiler.barcode || "",
      specUrl: boiler.specUrl || "",
      explodedViewUrl: boiler.explodedViewUrl || getDefaultExplodedViewUrl(boiler),
      notes: boiler.notes || "",
      parts: Array.isArray(boiler.parts)
        ? boiler.parts.map((part) => ({
            name: part.name || "",
            number: part.number || "",
            category: part.category || "",
            dispart: part.dispart || "",
            pex: part.pex || "",
            position: part.position || "",
            component: part.component || "",
            componentId: part.componentId || "",
            documentId: part.documentId || "",
            description: part.description || "",
            ean: part.ean || "",
            replacedBy: part.replacedBy || "",
            source: part.source || ""
          }))
        : []
    }));
    saveBoilers();
    renderResults();
  } catch {
    alert("Ce fichier JSON n'a pas pu Ãªtre importé.");
  } finally {
    event.target.value = "";
  }
});

elements.openScanner.addEventListener("click", () => startScanner());

elements.closeScanner.addEventListener("click", () => stopScanner());

elements.closeDetail.addEventListener("click", () => closeDetail());

elements.detailModal.addEventListener("click", (event) => {
  if (event.target === elements.detailModal) {
    closeDetail();
  }
});

elements.manualScan.addEventListener("click", () => {
  handleScannedCode(elements.manualBarcode.value);
});

elements.ocrScan.addEventListener("click", () => {
  scanPlateText();
});

elements.manualBarcode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleScannedCode(elements.manualBarcode.value);
  }
});

elements.showLogin.addEventListener("click", () => showAuthMode("login"));

elements.showSignup.addEventListener("click", () => showAuthMode("signup"));

elements.guestLogin.addEventListener("click", () => showGuestApp());

elements.signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = elements.signupUsername.value.trim();
  const email = normalizeIdentifier(elements.signupEmail.value);
  const password = elements.signupPassword.value;
  const users = getUsers();
  const role = users.length === 0 ? "admin" : "operator";

  if (password.length < 6) {
    setAuthMessage("Le mot de passe doit contenir au moins 6 caractères.", "error");
    return;
  }

  const usernameTaken = users.some((user) => normalizeIdentifier(user.username) === normalizeIdentifier(username));
  const emailTaken = users.some((user) => user.email === email);
  if (usernameTaken || emailTaken) {
    setAuthMessage("Ce nom d'utilisateur ou email existe déjà.", "error");
    return;
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    id: createId(),
    username,
    email,
    role,
    salt,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  saveUsers([...users, user]);
  localStorage.setItem(SESSION_KEY, user.id);
  elements.signupForm.reset();
  showApp(user);
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const identifier = normalizeIdentifier(elements.loginIdentifier.value);
  const password = elements.loginPassword.value;
  const user = getUsers().find(
    (item) => item.email === identifier || normalizeIdentifier(item.username) === identifier
  );

  if (!user) {
    setAuthMessage("Compte introuvable.", "error");
    return;
  }

  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    setAuthMessage("Mot de passe incorrect.", "error");
    return;
  }

  localStorage.setItem(SESSION_KEY, user.id);
  elements.loginForm.reset();
  showApp(user);
});

elements.logoutButton.addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  stopScanner();
  showAuth();
});

try {
  resetForm();
  restoreSession();
} catch (error) {
  console.error("Erreur de démarrage BoilerCore", error);
  localStorage.removeItem(SESSION_KEY);
  showAuth();
  setAuthMessage("L'application a réinitialisé la session après une erreur de chargement. Connectez-vous ou créez un compte.", "error");
}

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js");
}





