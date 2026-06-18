/* ============================================================
   FLOW — app.js  v3
   Bugs corregidos:
   - Eliminación de tareas "mañana" (botón × funcional)
   - Exportar limpia la lista de tareas del día
   - Editar y eliminar proyectos
   - Barra de progreso con zona de color
   - Toast de confirmación
============================================================ */
'use strict';

// ── Constantes ────────────────────────────────────────────
const STORAGE_KEY = 'flow-v3';
const COLORS = ['#ff3b30','#ff9500','#ffcc00','#34c759','#007aff','#5856d6','#af52de','#ff2d55','#636366'];
const EMOJIS_DEFAULT = ['🚀','💡','📊','🎯','🛠','📱','💼','🌟','🔥'];

// ── Estado ────────────────────────────────────────────────
const state = {
  projects: load(),
  view: 'dashboard',
  activeProjectId: null,
  editingProjectId: null,
};

// ── Persistencia ──────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
}

// ── Utilidades ────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function getProject(id) { return state.projects.find(p => p.id === id); }

function formatDateES(date = new Date()) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(date);
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, duration = 2600) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── Progress zone ─────────────────────────────────────────
function applyProgressZone(fill, value) {
  if (!fill) return;
  const v = Number(value);
  let color;
  if (v === 100) color = '#0f9d58';
  else if (v >= 65) color = '#2383e2';
  else if (v >= 35) color = '#dfab01';
  else color = '#e03e3e';
  fill.style.background = color;
  fill.style.backgroundImage = 'none';
}

// ── Render: sidebar ───────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebarProjects');
  const isDash = state.view === 'dashboard';
  document.querySelector('.nav-item[data-section="dashboard"]')
    .classList.toggle('active', isDash);

  if (!state.projects.length) { nav.innerHTML = ''; return; }

  nav.innerHTML = state.projects.map(p => `
    <button
      class="sidebar-project-item ${state.activeProjectId === p.id && state.view === 'project' ? 'active' : ''}"
      data-id="${p.id}"
    >
      <span class="sidebar-dot" style="background:${p.color}"></span>
      <span class="sidebar-project-name">${escHtml(p.emoji || '📁')} ${escHtml(p.name)}</span>
    </button>
  `).join('');

  nav.querySelectorAll('.sidebar-project-item').forEach(btn => {
    btn.addEventListener('click', () => openProject(btn.dataset.id));
  });
}

// ── Render: dashboard ─────────────────────────────────────
function renderDashboard() {
  // subtitle
  const sub = document.getElementById('dashSubtitle');
  if (sub) {
    const n = state.projects.length;
    sub.textContent = n === 0 ? '' : n === 1 ? '1 proyecto activo' : `${n} proyectos activos`;
  }
  const grid = document.getElementById('projectGrid');
  if (!state.projects.length) {
    grid.innerHTML = `
      <div class="empty-dashboard" style="grid-column:1/-1">
        <div class="empty-icon">✦</div>
        <strong>Empieza creando tu primer proyecto</strong><br>
        Pulsa el botón <strong>+</strong> para añadir uno.
      </div>`;
    return;
  }

  grid.innerHTML = state.projects.map(p => `
    <div class="project-tile" data-id="${p.id}" role="button" tabindex="0" aria-label="${escHtml(p.name)}">
      <div class="project-tile-cover" style="background:${p.color}22">
        <span style="filter:drop-shadow(0 2px 6px ${p.color}66)">${escHtml(p.emoji || '📁')}</span>
      </div>
      <div class="project-tile-name">${escHtml(p.name)}</div>
      ${p.desc ? `<div class="project-tile-desc">${escHtml(p.desc)}</div>` : ''}
      <div class="project-tile-progress">
        <div class="project-tile-progress-fill" style="width:${p.progress || 0}%; background:${p.color}cc"></div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.project-tile').forEach(tile => {
    tile.addEventListener('click', () => openProject(tile.dataset.id));
    tile.addEventListener('keydown', e => { if (e.key === 'Enter') openProject(tile.dataset.id); });
  });
}

// ── Render: project view ──────────────────────────────────
function renderProject() {
  const p = getProject(state.activeProjectId);
  if (!p) { goToDashboard(); return; }

  document.getElementById('projectEmoji').textContent = p.emoji || '📁';
  document.getElementById('projectTitle').textContent = p.name;
  document.getElementById('projectDesc').textContent = p.desc || '';

  const slider = document.getElementById('progressSlider');
  const fill = document.getElementById('progressFill');
  const valEl = document.getElementById('progressValue');

  slider.value = p.progress || 0;
  fill.style.width = `${p.progress || 0}%`;
  valEl.textContent = `${p.progress || 0}%`;
  applyProgressZone(fill, p.progress || 0);

  renderSteps();
  renderTomorrow();
}

// ── Render: steps ─────────────────────────────────────────
function renderSteps() {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  const list = document.getElementById('stepsList');

  const pending = (p.steps || []).filter(s => !s.done);
  const done = (p.steps || []).filter(s => s.done);

  const stepHtml = (s) => `
    <div class="step-row" data-sid="${s.id}">
      <button class="step-checkbox ${s.done ? 'checked' : ''}" data-sid="${s.id}" aria-label="${s.done ? 'Desmarcar' : 'Marcar como hecho'}"></button>
      <span class="step-text ${s.done ? 'done' : ''}">${escHtml(s.text)}</span>
      <button class="step-delete" data-sid="${s.id}" aria-label="Eliminar paso">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>`;

  list.innerHTML =
    pending.map(stepHtml).join('') +
    (done.length ? `<div class="steps-done-divider">Completados · ${done.length}</div>` + done.map(stepHtml).join('') : '');

  list.querySelectorAll('.step-checkbox').forEach(btn => {
    btn.addEventListener('click', () => toggleStep(btn.dataset.sid));
  });
  list.querySelectorAll('.step-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteStep(btn.dataset.sid));
  });
}

// ── Render: tomorrow ──────────────────────────────────────
function renderTomorrow() {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  const list = document.getElementById('tomorrowList');

  if (!(p.tomorrow || []).length) {
    list.innerHTML = '<div style="color:var(--text-tertiary);font-size:12px;padding:8px 6px;">Sin acciones por ahora.</div>';
    return;
  }

  list.innerHTML = (p.tomorrow || []).map(t => `
    <div class="tomorrow-row" data-tid="${t.id}">
      <span class="tomorrow-bullet"></span>
      <span class="tomorrow-text">${escHtml(t.text)}</span>
      <button class="tomorrow-delete" data-tid="${t.id}" aria-label="Eliminar acción">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');

  // ✅ FIX: botones eliminar "mañana" correctamente enlazados
  list.querySelectorAll('.tomorrow-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTomorrow(btn.dataset.tid));
  });
}

// ── Acciones: steps ───────────────────────────────────────
function addStep(text) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  p.steps = p.steps || [];
  p.steps.push({ id: uid(), text, done: false });
  save(); renderSteps();
}

function toggleStep(sid) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  const s = p.steps.find(s => s.id === sid);
  if (s) s.done = !s.done;
  save(); renderSteps();
}

function deleteStep(sid) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  p.steps = p.steps.filter(s => s.id !== sid);
  save(); renderSteps();
}

// ── Acciones: tomorrow ────────────────────────────────────
function addTomorrow(text) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  p.tomorrow = p.tomorrow || [];
  p.tomorrow.push({ id: uid(), text });
  save(); renderTomorrow();
}

// ✅ FIX: deleteTomorrow ahora busca por id correcto
function deleteTomorrow(tid) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  p.tomorrow = (p.tomorrow || []).filter(t => t.id !== tid);
  save(); renderTomorrow();
  showToast('Acción eliminada');
}

// ── Exportar mi día ───────────────────────────────────────
// ✅ FIX: después de exportar, limpia las acciones del día
function exportDay() {
  const p = getProject(state.activeProjectId);
  if (!p) return;

  const date = formatDateES();
  const steps = (p.steps || []).map(s => `  ${s.done ? '✅' : '⬜'} ${s.text}`).join('\n');
  const tomorrow = (p.tomorrow || []).map(t => `  • ${t.text}`).join('\n');

  const text =
    `📋 FLOW — Resumen del día\n` +
    `${date}\n\n` +
    `Proyecto: ${p.emoji || ''} ${p.name}\n` +
    `Avance: ${p.progress || 0}%\n\n` +
    `PASOS DEL PROYECTO:\n${steps || '  (ninguno)'}\n\n` +
    `ACCIONES PARA MAÑANA:\n${tomorrow || '  (ninguna)'}`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 Copiado al portapapeles');
  }).catch(() => {
    // fallback: descarga como .txt
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `flow-${p.name.replace(/\s+/g,'-')}.txt`;
    a.click(); URL.revokeObjectURL(url);
    showToast('📄 Archivo descargado');
  });

  // ✅ Limpiar lista "para mañana" tras exportar
  p.tomorrow = [];
  save(); renderTomorrow();
}

// ── Navegación ────────────────────────────────────────────
function goToDashboard() {
  state.view = 'dashboard';
  state.activeProjectId = null;
  document.getElementById('viewDashboard').classList.remove('hidden');
  document.getElementById('viewProject').classList.add('hidden');
  renderDashboard();
  renderSidebar();
}

function openProject(id) {
  const p = getProject(id);
  if (!p) return;
  state.view = 'project';
  state.activeProjectId = id;
  document.getElementById('viewDashboard').classList.add('hidden');
  document.getElementById('viewProject').classList.remove('hidden');
  renderProject();
  renderSidebar();
}

// ── Modal: crear / editar proyecto ───────────────────────
let selectedColor = COLORS[4];

function openModal(editId = null) {
  state.editingProjectId = editId;
  const modal = document.getElementById('modalOverlay');
  const title = document.getElementById('modalTitle');
  const formSubmit = document.getElementById('formSubmit');

  if (editId) {
    const p = getProject(editId);
    document.getElementById('formName').value = p.name;
    document.getElementById('formDesc').value = p.desc || '';
    document.getElementById('formEmoji').value = p.emoji || '';
    selectedColor = p.color || COLORS[4];
    title.textContent = 'Editar proyecto';
    formSubmit.textContent = 'Guardar cambios';
  } else {
    document.getElementById('projectForm').reset();
    document.getElementById('formEmoji').value = EMOJIS_DEFAULT[Math.floor(Math.random() * EMOJIS_DEFAULT.length)];
    selectedColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    title.textContent = 'Nuevo proyecto';
    formSubmit.textContent = 'Crear proyecto';
  }

  renderColorRow();
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('formName').focus(), 60);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  state.editingProjectId = null;
}

function renderColorRow() {
  const row = document.getElementById('colorRow');
  row.innerHTML = COLORS.map(c => `
    <button type="button" class="color-swatch ${c === selectedColor ? 'active' : ''}"
      style="background:${c}" data-color="${c}" aria-label="Color ${c}"></button>
  `).join('');
  row.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      selectedColor = sw.dataset.color;
      renderColorRow();
    });
  });
}

function submitProject(e) {
  e.preventDefault();
  const name = document.getElementById('formName').value.trim();
  const desc = document.getElementById('formDesc').value.trim();
  const emoji = document.getElementById('formEmoji').value.trim() || '📁';
  if (!name) return;

  if (state.editingProjectId) {
    const p = getProject(state.editingProjectId);
    if (p) { p.name = name; p.desc = desc; p.emoji = emoji; p.color = selectedColor; }
    showToast('✏️ Proyecto actualizado');
  } else {
    state.projects.push({
      id: uid(), name, desc, emoji,
      color: selectedColor,
      progress: 0, steps: [], tomorrow: [],
    });
    showToast('✦ Proyecto creado');
  }

  save(); closeModal();
  if (state.view === 'dashboard') renderDashboard();
  else if (state.view === 'project' && state.editingProjectId === state.activeProjectId) renderProject();
  renderSidebar();
}

// ── Eliminar proyecto ─────────────────────────────────────
function deleteProject(id) {
  const p = getProject(id);
  if (!p) return;
  if (!confirm(`¿Eliminar el proyecto "${p.name}"? Esta acción no se puede deshacer.`)) return;
  state.projects = state.projects.filter(x => x.id !== id);
  save(); showToast('🗑 Proyecto eliminado');
  goToDashboard();
}

// ── Escape HTML ───────────────────────────────────────────
function escHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────
function init() {
  // Dashboard
  document.querySelector('.nav-item[data-section="dashboard"]')
    .addEventListener('click', goToDashboard);
  document.getElementById('btnNewProject').addEventListener('click', () => openModal());
  document.getElementById('btnNewProjectSidebar').addEventListener('click', () => openModal());

  // Volver
  document.getElementById('btnBack').addEventListener('click', goToDashboard);

  // Editar / eliminar proyecto
  document.getElementById('btnEditProject').addEventListener('click', () => openModal(state.activeProjectId));
  document.getElementById('btnDeleteProject').addEventListener('click', () => deleteProject(state.activeProjectId));

  // Progress slider
  const slider = document.getElementById('progressSlider');
  const fill = document.getElementById('progressFill');
  const valEl = document.getElementById('progressValue');

  slider.addEventListener('input', () => {
    const v = slider.value;
    fill.style.width = `${v}%`;
    valEl.textContent = `${v}%`;
    applyProgressZone(fill, v);
    const p = getProject(state.activeProjectId);
    if (p) { p.progress = Number(v); save(); }
  });

  // Añadir paso
  document.getElementById('stepAddForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = document.getElementById('stepInput');
    if (inp.value.trim()) { addStep(inp.value.trim()); inp.value = ''; }
  });

  // Añadir tarea mañana
  document.getElementById('tomorrowAddForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = document.getElementById('tomorrowInput');
    if (inp.value.trim()) { addTomorrow(inp.value.trim()); inp.value = ''; }
  });

  // Exportar
  document.getElementById('btnExport').addEventListener('click', exportDay);

  // Modal
  document.getElementById('projectForm').addEventListener('submit', submitProject);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // Render inicial
  renderDashboard();
  renderSidebar();
}

document.addEventListener('DOMContentLoaded', init);