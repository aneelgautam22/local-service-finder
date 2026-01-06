// ===== Local Service Finder (Frontend) =====
// Works with Flask API endpoints:
// GET    /api/meta
// GET    /api/services?category=&area=&q=
// POST   /api/services
// PUT    /api/services/:id
// DELETE /api/services/:id

// ✅ IMPORTANT: Change API to your Render URL for public use
const API = "https://local-service-finder-api.onrender.com/api";

// Elements
const categorySelect = document.getElementById("categorySelect");
const areaSelect = document.getElementById("areaSelect");
const keywordInput = document.getElementById("keywordInput");
const searchBtn = document.getElementById("searchBtn");
const resultsBox = document.getElementById("resultsBox");
const refreshBtn = document.getElementById("refreshBtn");

// Add/Edit form
const nameInput = document.getElementById("nameInput");
const categoryInput = document.getElementById("categoryInput");
const areaInput = document.getElementById("areaInput");
const phoneInput = document.getElementById("phoneInput");
const descInput = document.getElementById("descInput");
const saveBtn = document.getElementById("saveBtn");

const modeBtn = document.getElementById("modeBtn");
const formTitle = document.getElementById("formTitle");

let editId = null; // null => add mode

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function loadMeta() {
  const meta = await fetchJSON(`${API}/meta`);

  // Fill category dropdown
  categorySelect.innerHTML = `<option value="">All Categories</option>`;
  meta.categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  });

  // Fill area dropdown
  areaSelect.innerHTML = `<option value="">All Areas</option>`;
  meta.areas.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    areaSelect.appendChild(opt);
  });
}

function renderResults(list) {
  if (!list || list.length === 0) {
    resultsBox.innerHTML = `<div class="empty">No services found.</div>`;
    return;
  }

  resultsBox.innerHTML = list
    .map(
      (s) => `
      <div class="result-card">
        <div class="result-top">
          <div class="result-title">${escapeHtml(s.name)}</div>
          <div class="result-actions">
            <button class="mini" onclick="startEdit(${s.id})">Edit</button>
            <button class="mini danger" onclick="deleteService(${s.id})">Delete</button>
          </div>
        </div>
        <div class="result-meta">
          <span class="pill">${escapeHtml(s.category)}</span>
          <span class="pill">${escapeHtml(s.area)}</span>
          <span class="pill">${escapeHtml(s.phone)}</span>
        </div>
        <div class="result-desc">${escapeHtml(s.description || "")}</div>
      </div>
    `
    )
    .join("");
}

async function searchServices() {
  const category = categorySelect.value || "";
  const area = areaSelect.value || "";
  const q = (keywordInput.value || "").trim();

  const url =
    `${API}/services?` +
    `category=${encodeURIComponent(category)}` +
    `&area=${encodeURIComponent(area)}` +
    `&q=${encodeURIComponent(q)}`;

  const list = await fetchJSON(url);
  renderResults(list);
}

function setAddMode() {
  editId = null;
  formTitle.textContent = "Add New Service";
  modeBtn.textContent = "ADD MODE";
  saveBtn.textContent = "Save";

  nameInput.value = "";
  categoryInput.value = "";
  areaInput.value = "";
  phoneInput.value = "";
  descInput.value = "";
}

function setEditMode(service) {
  editId = service.id;
  formTitle.textContent = "Edit Service";
  modeBtn.textContent = "EDIT MODE";
  saveBtn.textContent = "Update";

  nameInput.value = service.name || "";
  categoryInput.value = service.category || "";
  areaInput.value = service.area || "";
  phoneInput.value = service.phone || "";
  descInput.value = service.description || "";
}

async function saveService() {
  const payload = {
    name: nameInput.value.trim(),
    category: categoryInput.value.trim(),
    area: areaInput.value.trim(),
    phone: phoneInput.value.trim(),
    description: descInput.value.trim(),
  };

  if (!payload.name || !payload.category || !payload.area || !payload.phone) {
    alert("Please fill: Name, Category, Area, Phone");
    return;
  }

  if (editId === null) {
    // Add
    await fetchJSON(`${API}/services`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAddMode();
    await loadMeta();
    await searchServices();
    alert("Saved!");
  } else {
    // Update
    await fetchJSON(`${API}/services/${editId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setAddMode();
    await loadMeta();
    await searchServices();
    alert("Updated!");
  }
}

// Expose functions for inline onclick buttons
window.startEdit = async function (id) {
  // We fetch all and find (simple)
  const list = await fetchJSON(`${API}/services?category=&area=&q=`);
  const service = list.find((x) => x.id === id);
  if (!service) return alert("Service not found");
  setEditMode(service);
};

window.deleteService = async function (id) {
  if (!confirm("Delete this service?")) return;
  await fetchJSON(`${API}/services/${id}`, { method: "DELETE" });
  await loadMeta();
  await searchServices();
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Events
searchBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  searchServices().catch((err) => alert(err.message));
});

refreshBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  loadMeta()
    .then(searchServices)
    .catch((err) => alert(err.message));
});

saveBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  saveService().catch((err) => alert(err.message));
});

modeBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  setAddMode();
});

// Init
(async function init() {
  try {
    setAddMode();
    await loadMeta();
    await searchServices();
  } catch (err) {
    console.error(err);
    alert("API not reachable. Check Render URL in app.js");
  }
})();
