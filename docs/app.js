// ===== Local Service Finder (Frontend) =====
// GitHub Pages (docs/) static frontend that talks to Render backend API.

// ✅ Render backend base URL (DO NOT add extra slash at end)
const API = "https://local-service-finder-api.onrender.com/api";

// ---------- Helpers ----------
async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  // handle non-JSON errors nicely
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`;
    try {
      const text = await res.text();
      if (text) msg = text;
    } catch (e) {}
    throw new Error(msg);
  }

  // some endpoints might return empty
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Elements (IDs must match index.html) ----------
const categorySelect = document.getElementById("categorySelect");
const areaSelect = document.getElementById("areaSelect");
const keywordInput = document.getElementById("keywordInput");
const searchBtn = document.getElementById("searchBtn");
const refreshBtn = document.getElementById("refreshBtn");
const resultsBox = document.getElementById("resultsBox");

// Add/Edit form
const formTitle = document.getElementById("formTitle");
const modeBtn = document.getElementById("modeBtn");

const nameInput = document.getElementById("nameInput");
const categoryInput = document.getElementById("categoryInput");
const areaInput = document.getElementById("areaInput");
const phoneInput = document.getElementById("phoneInput");
const descInput = document.getElementById("descInput");
const saveBtn = document.getElementById("saveBtn");

// State
let editId = null; // null = add mode

// ---------- Load meta (categories/areas) ----------
async function loadMeta() {
  const meta = await fetchJSON(`${API}/meta`);

  // category dropdown
  categorySelect.innerHTML = `<option value="">All Categories</option>`;
  (meta?.categories || []).forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  });

  // area dropdown
  areaSelect.innerHTML = `<option value="">All Areas</option>`;
  (meta?.areas || []).forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    areaSelect.appendChild(opt);
  });
}

// ---------- Search ----------
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
  renderResults(list || []);
}

// ---------- Render ----------
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

// ---------- Form Modes ----------
function setAddMode() {
  editId = null;
  if (formTitle) formTitle.textContent = "Add New Service";
  if (modeBtn) modeBtn.textContent = "ADD MODE";
  if (saveBtn) saveBtn.textContent = "Save";

  nameInput.value = "";
  categoryInput.value = "";
  areaInput.value = "";
  phoneInput.value = "";
  descInput.value = "";
}

function setEditMode(service) {
  editId = service.id;
  if (formTitle) formTitle.textContent = "Edit Service";
  if (modeBtn) modeBtn.textContent = "EDIT MODE";
  if (saveBtn) saveBtn.textContent = "Update";

  nameInput.value = service.name || "";
  categoryInput.value = service.category || "";
  areaInput.value = service.area || "";
  phoneInput.value = service.phone || "";
  descInput.value = service.description || "";
}

// ---------- Save (Add/Update) ----------
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
    alert("Saved!");
  } else {
    // Update
    await fetchJSON(`${API}/services/${editId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    alert("Updated!");
  }

  setAddMode();
  await loadMeta();
  await searchServices();
}

// ---------- Edit/Delete (global for inline onclick) ----------
window.startEdit = async function (id) {
  const list = await fetchJSON(`${API}/services?category=&area=&q=`);
  const service = (list || []).find((x) => x.id === id);
  if (!service) return alert("Service not found");
  setEditMode(service);
};

window.deleteService = async function (id) {
  if (!confirm("Delete this service?")) return;
  await fetchJSON(`${API}/services/${id}`, { method: "DELETE" });
  await loadMeta();
  await searchServices();
};

// ---------- Events ----------
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

// ---------- Init ----------
(async function init() {
  try {
    setAddMode();

    // Wake up Render free instance (optional but helps)
    try {
      await fetchJSON(`${API}/health`);
    } catch (e) {
      // ignore; we'll show main error later if needed
    }

    await loadMeta();
    await searchServices();
  } catch (err) {
    console.error(err);
    alert("API not reachable. Check Render URL in app.js");
  }
})();
