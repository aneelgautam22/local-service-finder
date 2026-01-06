const API = "https://local-service-finder-api.onrender.com/api";


const resultsEl = document.getElementById("results");
const msgEl = document.getElementById("msg");

const catEl = document.getElementById("category");
const areaEl = document.getElementById("area");
const keywordEl = document.getElementById("keyword");

const nameEl = document.getElementById("name");
const newCategoryEl = document.getElementById("newCategory");
const newAreaEl = document.getElementById("newArea");
const phoneEl = document.getElementById("phone");
const descEl = document.getElementById("desc");

const btnSearch = document.getElementById("btnSearch");
const btnSave = document.getElementById("btnSave");
const btnCancel = document.getElementById("btnCancel");
const btnRefresh = document.getElementById("btnRefresh");

const formTitle = document.getElementById("formTitle");
const modeBadge = document.getElementById("modeBadge");

let editingId = null;

// ---------- Helpers ----------
function setMsg(text, ok=true){
  msgEl.style.color = ok ? "green" : "crimson";
  msgEl.textContent = text || "";
}

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function validateService({name, category, area, phone}){
  if(!name.trim() || !category.trim() || !area.trim() || !phone.trim()){
    return "Name, Category, Area, Phone are required.";
  }
  // allow digits, +, space, -
  if(!/^[0-9+ -]{7,20}$/.test(phone.trim())){
    return "Phone looks invalid. Use digits only (or +, space, -).";
  }
  return null;
}

function setModeEdit(isEdit){
  if(isEdit){
    formTitle.textContent = "Edit Service";
    modeBadge.textContent = "EDIT MODE";
    btnCancel.style.display = "inline-block";
  } else {
    formTitle.textContent = "Add New Service";
    modeBadge.textContent = "ADD MODE";
    btnCancel.style.display = "none";
  }
}

// ---------- Load Meta ----------
async function loadMeta(){
  const res = await fetch(`${API}/meta`);
  const data = await res.json();

  catEl.innerHTML = `<option value="">All Categories</option>`;
  areaEl.innerHTML = `<option value="">All Areas</option>`;

  data.categories.forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    catEl.appendChild(o);
  });

  data.areas.forEach(a => {
    const o = document.createElement("option");
    o.value = a; o.textContent = a;
    areaEl.appendChild(o);
  });
}

// ---------- Search ----------
async function search(){
  setMsg("");
  const params = new URLSearchParams();
  if(catEl.value) params.set("category", catEl.value);
  if(areaEl.value) params.set("area", areaEl.value);
  if(keywordEl.value.trim()) params.set("q", keywordEl.value.trim());

  const res = await fetch(`${API}/services?${params.toString()}`);
  const data = await res.json();

  resultsEl.innerHTML = "";

  if(!Array.isArray(data) || data.length === 0){
    resultsEl.innerHTML = `<div style="opacity:.7;">No services found.</div>`;
    return;
  }

  data.forEach(s => resultsEl.appendChild(renderCard(s)));
}

function renderCard(s){
  const div = document.createElement("div");
  div.className = "item";

  const name = escapeHtml(s.name);
  const category = escapeHtml(s.category);
  const area = escapeHtml(s.area);
  const phone = escapeHtml(s.phone);
  const desc = escapeHtml(s.description || "");

  div.innerHTML = `
    <div class="badges">
      <span class="badge">${category}</span>
      <span class="badge">${area}</span>
    </div>
    <div class="name">${name}</div>
    <div class="desc">${desc}</div>
    <div class="phone">📞 ${phone}</div>

    <div class="actions">
      <a href="tel:${phone}">Call</a>
      <button class="ghost btnCopy">Copy</button>
      <button class="ghost btnEdit">Edit</button>
      <button class="btnDel">Delete</button>
    </div>
  `;

  div.querySelector(".btnCopy").addEventListener("click", async () => {
    await navigator.clipboard.writeText(s.phone);
    alert("Copied: " + s.phone);
  });

  div.querySelector(".btnEdit").addEventListener("click", () => startEdit(s));
  div.querySelector(".btnDel").addEventListener("click", () => deleteService(s.id));

  return div;
}

// ---------- Add / Update ----------
async function saveService(){
  setMsg("");

  const payload = {
    name: nameEl.value.trim(),
    category: newCategoryEl.value.trim(),
    area: newAreaEl.value.trim(),
    phone: phoneEl.value.trim(),
    description: descEl.value.trim()
  };

  const err = validateService(payload);
  if(err){ setMsg(err, false); return; }

  if(editingId === null){
    // CREATE
    const res = await fetch(`${API}/services`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok){ setMsg(data.error || "Failed to add service", false); return; }
    setMsg("✅ Added successfully!");
  } else {
    // UPDATE
    const res = await fetch(`${API}/services/${editingId}`, {
      method: "PUT",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok){ setMsg(data.error || "Failed to update service", false); return; }
    setMsg("✅ Updated successfully!");
  }

  clearForm();
  await loadMeta();
  await search();
}

function startEdit(s){
  editingId = s.id;
  setModeEdit(true);

  nameEl.value = s.name || "";
  newCategoryEl.value = s.category || "";
  newAreaEl.value = s.area || "";
  phoneEl.value = s.phone || "";
  descEl.value = s.description || "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearForm(){
  editingId = null;
  setModeEdit(false);

  nameEl.value = "";
  newCategoryEl.value = "";
  newAreaEl.value = "";
  phoneEl.value = "";
  descEl.value = "";
}

// ---------- Delete ----------
async function deleteService(id){
  if(!confirm("Delete this service?")) return;

  const res = await fetch(`${API}/services/${id}`, { method: "DELETE" });
  const data = await res.json();

  if(!res.ok){
    setMsg(data.error || "Failed to delete", false);
    return;
  }

  setMsg("🗑️ Deleted!");
  await loadMeta();
  await search();
}

// ---------- Events ----------
btnSearch.addEventListener("click", search);
btnSave.addEventListener("click", saveService);
btnCancel.addEventListener("click", clearForm);
btnRefresh.addEventListener("click", async () => {
  await loadMeta();
  await search();
});

// optional: Search as you type (enable if you want)
// keywordEl.addEventListener("input", () => search());

(async function init(){
  setModeEdit(false);
  await loadMeta();
  await search();
})();
