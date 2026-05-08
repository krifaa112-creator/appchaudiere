const STORAGE_KEY = "boiler-parts-library-v1";
const USERS_KEY = "boiler-core-users-v1";
const SESSION_KEY = "boiler-core-session-v1";
const INVENTORY_RESET_KEY = "boiler-core-inventory-reset-empty-v1";

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
    notes: "Exemple de fiche. Remplacez-la ou supprimez-la quand vous ajoutez votre propre base.",
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
    notes: "Exemple de fiche.",
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
    notes: "Fiche à compléter avec les numéros de pièces.",
    parts: []
  }
];

const state = {
  boilers: loadBoilers(),
  query: "",
  editingId: null
};

const elements = {
  appShell: document.querySelector("#appShell"),
  authScreen: document.querySelector("#authScreen"),
  showLogin: document.querySelector("#showLogin"),
  showSignup: document.querySelector("#showSignup"),
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
  notes: document.querySelector("#notes"),
  partsList: document.querySelector("#partsList"),
  partRowTemplate: document.querySelector("#partRowTemplate"),
  addPart: document.querySelector("#addPart"),
  saveModel: document.querySelector("#saveModel"),
  cancelEdit: document.querySelector("#cancelEdit"),
  search: document.querySelector("#modelSearch"),
  clearSearch: document.querySelector("#clearSearch"),
  results: document.querySelector("#results"),
  resultsSummary: document.querySelector("#resultsSummary"),
  totalModels: document.querySelector("#totalModels"),
  metricModels: document.querySelector("#metricModels"),
  metricParts: document.querySelector("#metricParts"),
  metricManufacturers: document.querySelector("#metricManufacturers"),
  exportJson: document.querySelector("#exportJson"),
  exportCsv: document.querySelector("#exportCsv"),
  importJson: document.querySelector("#importJson"),
  openScanner: document.querySelector("#openScanner"),
  closeScanner: document.querySelector("#closeScanner"),
  scannerModal: document.querySelector("#scannerModal"),
  cameraPreview: document.querySelector("#cameraPreview"),
  scannerStatus: document.querySelector("#scannerStatus"),
  manualBarcode: document.querySelector("#manualBarcode"),
  manualScan: document.querySelector("#manualScan")
};

let scannerStream = null;
let scannerTimer = null;
let currentUser = null;

function getUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    return normalizeUsers(users);
  } catch {
    return [];
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
    return normalizeBoilers(sampleData);
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? ensureStarterModels(translateExampleData(normalizeBoilers(parsed))) : normalizeBoilers(sampleData);
  } catch {
    return normalizeBoilers(sampleData);
  }
}

function normalizeBoilers(boilers) {
  return boilers
    .filter((boiler) => boiler && typeof boiler === "object")
    .map((boiler) => ({
      id: boiler.id || createId(),
      manufacturer: String(boiler.manufacturer || ""),
      model: String(boiler.model || ""),
      barcode: String(boiler.barcode || ""),
      specUrl: String(boiler.specUrl || ""),
      notes: String(boiler.notes || ""),
      parts: Array.isArray(boiler.parts)
        ? boiler.parts
            .filter((part) => part && typeof part === "object")
            .map((part) => ({
              name: String(part.name || ""),
              number: String(part.number || ""),
              category: String(part.category || "")
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.boilers));
}

function addPartRow(part = {}) {
  if (currentUser && !isAdmin()) return;
  const row = elements.partRowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".part-name").value = part.name || "";
  row.querySelector(".part-number").value = part.number || "";
  row.querySelector(".part-category").value = part.category || "";
  row.querySelector(".remove-part").addEventListener("click", () => {
    if (elements.partsList.children.length > 1) {
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
    boiler.notes,
    ...(boiler.parts || []).flatMap((part) => [part.name, part.number, part.category])
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes(query.toLowerCase());
}

function renderResults() {
  const filtered = state.boilers.filter((boiler) => matchesQuery(boiler, state.query));
  elements.results.replaceChildren();
  renderMetrics();

  elements.resultsSummary.textContent =
    filtered.length === 1 ? "1 modèle de chaudière trouvé" : `${filtered.length} modèles de chaudière trouvés`;

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucun modèle de chaudière trouvé. Ajoutez-le à droite ou importez votre base.";
    elements.results.append(empty);
    return;
  }

  filtered
    .sort((a, b) => `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`))
    .forEach((boiler) => elements.results.append(createBoilerCard(boiler)));
}

function renderMetrics() {
  const modelCount = state.boilers.length;
  const partCount = state.boilers.reduce((total, boiler) => total + (boiler.parts || []).length, 0);
  const manufacturerCount = new Set(
    state.boilers.map((boiler) => String(boiler.manufacturer || "").trim().toLowerCase()).filter(Boolean)
  ).size;

  elements.totalModels.textContent = modelCount;
  elements.metricModels.textContent = modelCount;
  elements.metricParts.textContent = partCount;
  elements.metricManufacturers.textContent = manufacturerCount;
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
  const buttonGroup = document.createElement("div");
  const specButton = document.createElement("button");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  title.textContent = boiler.model;
  manufacturer.className = "manufacturer";
  manufacturer.textContent = boiler.manufacturer;
  meta.className = "model-meta";
  meta.textContent = [boiler.barcode ? `Code-barres: ${boiler.barcode}` : "", boiler.specUrl ? "Fiche fournisseur disponible" : ""]
    .filter(Boolean)
    .join(" · ");
  notes.className = "notes";
  notes.textContent = boiler.notes || "";
  buttonGroup.className = "card-actions";
  specButton.className = "spec-model";
  specButton.type = "button";
  specButton.textContent = "Fiche fournisseur";
  specButton.disabled = !boiler.specUrl;
  specButton.addEventListener("click", () => openSpec(boiler));
  editButton.className = "edit-model";
  editButton.type = "button";
  editButton.textContent = "Modifier";
  editButton.addEventListener("click", () => editBoiler(boiler.id));
  deleteButton.className = "delete-model";
  deleteButton.type = "button";
  deleteButton.textContent = "Supprimer";
  deleteButton.addEventListener("click", () => deleteBoiler(boiler.id));
  buttonGroup.append(specButton);
  if (isAdmin()) {
    buttonGroup.append(editButton, deleteButton);
  }

  titleBlock.append(title, manufacturer);
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
    row.children[2].textContent = part.category || "Général";
    tbody.append(row);
  });

  card.append(header, table);
  return card;
}

function editBoiler(id) {
  if (!requireAdmin()) return;
  const boiler = state.boilers.find((item) => item.id === id);
  if (!boiler) return;

  state.editingId = id;
  elements.manufacturer.value = boiler.manufacturer;
  elements.model.value = boiler.model;
  elements.barcode.value = boiler.barcode || "";
  elements.specUrl.value = boiler.specUrl || "";
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

function openSpec(boiler) {
  if (!boiler.specUrl) {
    alert("Aucun lien fournisseur n'est enregistré pour ce modèle.");
    return;
  }

  window.open(boiler.specUrl, "_blank", "noopener");
}

function findBoilerByBarcode(code) {
  const cleanCode = code.trim().toLowerCase();
  if (!cleanCode) return null;

  return state.boilers.find((boiler) => {
    const values = [
      boiler.barcode,
      boiler.model,
      boiler.manufacturer,
      ...boiler.parts.flatMap((part) => [part.number, part.name])
    ];

    return values.some((value) => String(value || "").trim().toLowerCase() === cleanCode);
  });
}

function handleScannedCode(code) {
  const boiler = findBoilerByBarcode(code);
  stopScanner();
  elements.search.value = code;
  state.query = code;
  renderResults();

  if (!boiler) {
    alert(`Aucun modèle trouvé pour le code-barres: ${code}`);
    return;
  }

  if (boiler.specUrl) {
    openSpec(boiler);
  } else {
    alert(`${boiler.manufacturer} ${boiler.model} trouvé, mais aucun lien fournisseur n'est enregistré.`);
  }
}

async function startScanner() {
  elements.scannerModal.classList.remove("hidden");
  elements.scannerStatus.textContent = "Demande d'accès à la caméra...";

  if (!("BarcodeDetector" in window)) {
    elements.scannerStatus.textContent =
      "Le scanner automatique n'est pas disponible dans ce navigateur. Saisissez le code manuellement.";
    return;
  }

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

    const detector = new BarcodeDetector({
      formats: ["aztec", "code_128", "code_39", "code_93", "codabar", "data_matrix", "ean_13", "ean_8", "itf", "pdf417", "qr_code", "upc_a", "upc_e"]
    });

    elements.scannerStatus.textContent = "Recherche du code-barres...";
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
    ["Fabricant", "Modèle", "Code-barres", "Lien fiche fournisseur", "Notes", "Nom de la pièce", "Numéro de pièce", "Catégorie"]
  ];
  state.boilers.forEach((boiler) => {
    if (!boiler.parts.length) {
      rows.push([boiler.manufacturer, boiler.model, boiler.barcode || "", boiler.specUrl || "", boiler.notes || "", "", "", ""]);
      return;
    }

    boiler.parts.forEach((part) => {
      rows.push([
        boiler.manufacturer,
        boiler.model,
        boiler.barcode || "",
        boiler.specUrl || "",
        boiler.notes || "",
        part.name,
        part.number,
        part.category || ""
      ]);
    });
  });

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
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
    specUrl: elements.specUrl.value.trim(),
    notes: elements.notes.value.trim(),
    parts
  };

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

elements.search.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderResults();
});

elements.clearSearch.addEventListener("click", () => {
  state.query = "";
  elements.search.value = "";
  renderResults();
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
      barcode: boiler.barcode || "",
      specUrl: boiler.specUrl || "",
      notes: boiler.notes || "",
      parts: Array.isArray(boiler.parts) ? boiler.parts : []
    }));
    saveBoilers();
    renderResults();
  } catch {
    alert("Ce fichier JSON n'a pas pu être importé.");
  } finally {
    event.target.value = "";
  }
});

elements.openScanner.addEventListener("click", () => startScanner());

elements.closeScanner.addEventListener("click", () => stopScanner());

elements.manualScan.addEventListener("click", () => {
  handleScannedCode(elements.manualBarcode.value);
});

elements.manualBarcode.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleScannedCode(elements.manualBarcode.value);
  }
});

elements.showLogin.addEventListener("click", () => showAuthMode("login"));

elements.showSignup.addEventListener("click", () => showAuthMode("signup"));

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
