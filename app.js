/* ============================================================
   FLOW — app.js v4 (Firebase Auth + Firestore)
   ============================================================ */
'use strict';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Firebase config ─ REEMPLAZA CON TU CONFIG ──────────────
const firebaseConfig = {
  apiKey: "AIzaSyD7b3YogSKZ8GigNizZN6JHumUQ6lSyre4",
  authDomain: "flow-b450a.firebaseapp.com",
  projectId: "flow-b450a",
  storageBucket: "flow-b450a.firebasestorage.app",
  messagingSenderId: "177344386137",
  appId: "1:177344386137:web:a3ebc59923fb799eb90d48"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth        = getAuth(firebaseApp);
const db          = getFirestore(firebaseApp);

// ── Constantes ───────────────────────────────────────────────
const COLORS        = ['#ff3b30','#ff9500','#ffcc00','#34c759','#007aff','#5856d6','#af52de','#ff2d55','#636366'];
const EMOJIS_DEFAULT = ['🚀','💡','📊','🎯','🛠','📱','💼','🌟','🔥'];

// ── Estado ───────────────────────────────────────────────────
const state = {
  projects: [],
  view: 'dashboard',
  activeProjectId: null,
  editingProjectId: null,
  uid: null,
  unsubscribe: null,
};

// ── Helpers Firestore ────────────────────────────────────────
function projectsCol() {
  return collection(db, 'users', state.uid, 'projects');
}
function projectDoc(id) {
  return doc(db, 'users', state.uid, 'projects', id);
}

async function saveProject(project) {
  await setDoc(projectDoc(project.id), project);
}
async function removeProject(id) {
  await deleteDoc(projectDoc(id));
}

function subscribeProjects() {
  if (state.unsubscribe) state.unsubscribe();
  const q = query(projectsCol(), orderBy('createdAt', 'asc'));
  state.unsubscribe = onSnapshot(q, snap => {
    state.projects = snap.docs.map(d => d.data());
    renderAll();
  });
}

// ── Utilidades ───────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function getProject(id) { return state.projects.find(p => p.id === id); }
function formatDateES(date = new Date()) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  }).format(date);
}

// ── Toast ────────────────────────────────────────────────────
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

// ── Progress zone ────────────────────────────────────────────
function applyProgressZone(fill, value) {
  if (!fill) return;
  const v = Number(value);
  let color;
  if (v === 100)      color = '#0f9d58';
  else if (v >= 65)   color = '#2383e2';
  else if (v >= 35)   color = '#dfab01';
  else                color = '#e03e3e';
  fill.style.background = color;
  fill.style.backgroundImage = 'none';
}

// ── Render: sidebar ──────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebarProjects');
  const isDash = state.view === 'dashboard';
  document.querySelector('.nav-item[data-section="dashboard"]')
    .classList.toggle('active', isDash);

  if (!state.projects.length) { nav.innerHTML = ''; return; }
  nav.innerHTML = state.projects.map(p => `
    <button class="sidebar-project-item${state.activeProjectId === p.id && !isDash ? ' active' : ''}" data-id="${p.id}">
      <span class="sidebar-dot" style="background:${p.color}"></span>
      <span class="sidebar-project-name">${p.emoji} ${p.name}</span>
    </button>
  `).join('');
  nav.querySelectorAll('.sidebar-project-item').forEach(btn => {
    btn.addEventListener('click', () => openProject(btn.dataset.id));
  });
}

// ── Render: dashboard ────────────────────────────────────────
function renderDashboard() {
  const sub = document.getElementById('dashSubtitle');
  if (sub) {
    const n = state.projects.length;
    sub.textContent = n === 0 ? '' : n === 1 ? '1 proyecto activo' : `${n} proyectos activos`;
  }
  const grid = document.getElementById('projectGrid');
  if (!state.projects.length) {
    grid.innerHTML = `
      <div class="empty-dashboard" style="grid-column:1/-1">
        <div class="empty-icon">📂</div>
        <div>Todavía no tienes proyectos.<br>Pulsa <strong>+</strong> para crear el primero.</div>
      </div>`;
    return;
  }
  grid.innerHTML = state.projects.map(p => {
    const done  = (p.steps || []).filter(s => s.done).length;
    const total = (p.steps || []).length;
    const pct   = p.progress ?? 0;
    return `
      <div class="project-tile" data-id="${p.id}">
        <div class="project-tile-cover" style="background:${p.color}22">
          <span style="font-size:1.3rem">${p.emoji}</span>
        </div>
        <div class="project-tile-name">${p.name}</div>
        <div class="project-tile-desc">${p.desc || '&nbsp;'}</div>
        <div class="project-tile-meta">${done}/${total} pasos · ${pct}%</div>
        <div class="project-tile-progress">
          <div class="project-tile-progress-fill" style="width:${pct}%;background:${p.color}"></div>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.project-tile').forEach(tile => {
    tile.addEventListener('click', () => openProject(tile.dataset.id));
  });
}

// ── Render: project view ──────────────────────────────────────
function renderProjectView() {
  const p = getProject(state.activeProjectId);
  if (!p) return;

  document.getElementById('pvEmoji').textContent = p.emoji;
  document.getElementById('pvTitle').textContent = p.name;
  document.getElementById('pvDesc').textContent  = p.desc || '';

  const slider = document.getElementById('pvProgressSlider');
  const fill   = document.getElementById('pvProgressFill');
  const label  = document.getElementById('pvProgressLabel');
  const val    = p.progress ?? 0;
  slider.value = val;
  fill.style.width = val + '%';
  label.textContent = val + '%';
  applyProgressZone(fill, val);

  renderSteps(p);
  renderTomorrow(p);
}

function renderSteps(p) {
  const list = document.getElementById('stepsList');
  const steps = p.steps || [];
  if (!steps.length) { list.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:8px 4px">Sin pasos todavía.</div>'; return; }

  const pending = steps.filter(s => !s.done);
  const done    = steps.filter(s => s.done);

  list.innerHTML = [
    ...pending.map(s => stepHTML(s)),
    done.length ? `<div class="steps-done-divider">Completados (${done.length})</div>` : '',
    ...done.map(s => stepHTML(s))
  ].join('');

  list.querySelectorAll('.step-checkbox').forEach(cb => {
    cb.addEventListener('click', () => toggleStep(cb.dataset.id));
  });
  list.querySelectorAll('.step-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteStep(btn.dataset.id));
  });
}

function stepHTML(s) {
  return `
    <div class="step-row">
      <div class="step-checkbox${s.done ? ' checked' : ''}" data-id="${s.id}"></div>
      <span class="step-text${s.done ? ' done' : ''}">${s.text}</span>
      <button class="step-delete" data-id="${s.id}" title="Eliminar">✕</button>
    </div>`;
}

function renderTomorrow(p) {
  const list = document.getElementById('tomorrowList');
  const items = p.tomorrow || [];
  if (!items.length) { list.innerHTML = '<div style="color:var(--text-3);font-size:13px;padding:8px 4px">Sin acciones para mañana.</div>'; return; }
  list.innerHTML = items.map(t => `
    <div class="tomorrow-row">
      <span class="tomorrow-bullet"></span>
      <span class="tomorrow-text">${t.text}</span>
      <button class="tomorrow-delete" data-id="${t.id}" title="Eliminar">✕</button>
    </div>`).join('');
  list.querySelectorAll('.tomorrow-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTomorrow(btn.dataset.id));
  });
}

// ── Acciones de proyecto ──────────────────────────────────────
function openProject(id) {
  state.view = 'project';
  state.activeProjectId = id;
  document.getElementById('dashboardView').classList.add('hidden');
  document.getElementById('projectView').classList.remove('hidden');
  document.getElementById('fabWrap').classList.add('hidden');
  renderSidebar();
  renderProjectView();
}

function goToDashboard() {
  state.view = 'dashboard';
  state.activeProjectId = null;
  document.getElementById('dashboardView').classList.remove('hidden');
  document.getElementById('projectView').classList.add('hidden');
  document.getElementById('fabWrap').classList.remove('hidden');
  renderSidebar();
  renderDashboard();
}

async function toggleStep(stepId) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  p.steps = (p.steps || []).map(s => s.id === stepId ? { ...s, done: !s.done } : s);
  await saveProject(p);
}

async function deleteStep(stepId) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  p.steps = (p.steps || []).filter(s => s.id !== stepId);
  await saveProject(p);
}

async function deleteTomorrow(tId) {
  const p = getProject(state.activeProjectId);
  if (!p) return;
  p.tomorrow = (p.tomorrow || []).filter(t => t.id !== tId);
  await saveProject(p);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(editId = null) {
  state.editingProjectId = editId;
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('modalTitle');
  const submitBtn = document.getElementById('formSubmitBtn');

  buildEmojiRow();
  buildColorRow();

  if (editId) {
    const p = getProject(editId);
    document.getElementById('fieldName').value = p.name;
    document.getElementById('fieldDesc').value = p.desc || '';
    selectEmoji(p.emoji);
    selectColor(p.color);
    title.textContent = 'Editar proyecto';
    submitBtn.textContent = 'Guardar cambios';
  } else {
    document.getElementById('fieldName').value = '';
    document.getElementById('fieldDesc').value = '';
    selectEmoji(EMOJIS_DEFAULT[0]);
    selectColor(COLORS[4]);
    title.textContent = 'Nuevo proyecto';
    submitBtn.textContent = 'Crear proyecto';
  }

  modal.classList.remove('hidden');
  document.getElementById('fieldName').focus();
}

function closeModal() {
  document.getElementById('projectModal').classList.add('hidden');
  state.editingProjectId = null;
}

let _selectedEmoji = EMOJIS_DEFAULT[0];
let _selectedColor = COLORS[4];

function buildEmojiRow() {
  const row = document.getElementById('emojiRow');
  row.innerHTML = EMOJIS_DEFAULT.map(e => `
    <button type="button" class="emoji-swatch${e === _selectedEmoji ? ' active' : ''}" data-emoji="${e}">${e}</button>
  `).join('');
  row.querySelectorAll('.emoji-swatch').forEach(btn => {
    btn.addEventListener('click', () => selectEmoji(btn.dataset.emoji));
  });
}

function selectEmoji(e) {
  _selectedEmoji = e;
  document.querySelectorAll('.emoji-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.emoji === e);
  });
}

function buildColorRow() {
  const row = document.getElementById('colorRow');
  row.innerHTML = COLORS.map(c => `
    <div class="color-swatch${c === _selectedColor ? ' active' : ''}" data-color="${c}" style="background:${c}"></div>
  `).join('');
  row.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => selectColor(sw.dataset.color));
  });
}

function selectColor(c) {
  _selectedColor = c;
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === c);
  });
}

// ── Render all ───────────────────────────────────────────────
function renderAll() {
  renderSidebar();
  if (state.view === 'dashboard') renderDashboard();
  else renderProjectView();
}

// ── Login UI ─────────────────────────────────────────────────
function showLoginView() {
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  document.getElementById('fabWrap').classList.add('hidden');
}

function showAppView() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.getElementById('fabWrap').classList.remove('hidden');
}

function setLoginError(msg) {
  const el = document.getElementById('loginError');
  if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

// ── Auth state ───────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (user) {
    state.uid = user.id || user.uid;
    showAppView();
    subscribeProjects();
    renderSidebar();
    renderDashboard();
  } else {
    state.uid = null;
    if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe = null; }
    state.projects = [];
    showLoginView();
  }
});

// ── DOM ready ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Login form ──
  let isRegisterMode = false;

  document.getElementById('toggleLoginBtn').addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    setLoginError('');
    document.getElementById('loginForm').classList.toggle('hidden', isRegisterMode);
    document.getElementById('registerForm').classList.toggle('hidden', !isRegisterMode);
    document.getElementById('toggleLoginText').textContent = isRegisterMode ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
    document.getElementById('toggleLoginBtn').textContent  = isRegisterMode ? 'Iniciar sesión' : 'Crear cuenta';
  });

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    setLoginError('');
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    document.getElementById('loginBtn').textContent = 'Entrando…';
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setLoginError(friendlyError(err.code));
      document.getElementById('loginBtn').textContent = 'Iniciar sesión';
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    setLoginError('');
    const email    = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    document.getElementById('registerBtn').textContent = 'Creando…';
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setLoginError(friendlyError(err.code));
      document.getElementById('registerBtn').textContent = 'Crear cuenta';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (state.unsubscribe) state.unsubscribe();
    await signOut(auth);
    state.projects = [];
    state.view = 'dashboard';
    state.activeProjectId = null;
  });

  // ── Navegación ──
  document.querySelector('.nav-item[data-section="dashboard"]')
    .addEventListener('click', goToDashboard);
  document.getElementById('btnBack').addEventListener('click', goToDashboard);

  // ── FAB / Nuevo proyecto ──
  document.getElementById('fabBtn').addEventListener('click', () => openModal());
  document.getElementById('sidebarAddBtn').addEventListener('click', () => openModal());
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('projectModal').addEventListener('click', e => {
    if (e.target === document.getElementById('projectModal')) closeModal();
  });

  // ── Editar / Eliminar proyecto ──
  document.getElementById('btnEditProject').addEventListener('click', () => {
    if (state.activeProjectId) openModal(state.activeProjectId);
  });
  document.getElementById('btnDeleteProject').addEventListener('click', async () => {
    if (!state.activeProjectId) return;
    const p = getProject(state.activeProjectId);
    if (!p) return;
    if (!confirm(`¿Eliminar el proyecto "${p.name}"? Esta acción no se puede deshacer.`)) return;
    await removeProject(state.activeProjectId);
    goToDashboard();
    showToast('Proyecto eliminado.');
  });

  // ── Formulario de proyecto ──
  document.getElementById('projectForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('fieldName').value.trim();
    const desc = document.getElementById('fieldDesc').value.trim();
    if (!name) return;

    if (state.editingProjectId) {
      const p = getProject(state.editingProjectId);
      p.name  = name;
      p.desc  = desc;
      p.emoji = _selectedEmoji;
      p.color = _selectedColor;
      await saveProject(p);
      showToast('Proyecto actualizado.');
    } else {
      const newProject = {
        id: uid(), name, desc,
        emoji: _selectedEmoji, color: _selectedColor,
        progress: 0, steps: [], tomorrow: [],
        createdAt: Date.now()
      };
      await saveProject(newProject);
      showToast('Proyecto creado.');
    }
    closeModal();
  });

  // ── Progress slider ──
  document.getElementById('pvProgressSlider').addEventListener('input', async e => {
    const val  = Number(e.target.value);
    const fill = document.getElementById('pvProgressFill');
    fill.style.width = val + '%';
    document.getElementById('pvProgressLabel').textContent = val + '%';
    applyProgressZone(fill, val);
    const p = getProject(state.activeProjectId);
    if (!p) return;
    p.progress = val;
    await saveProject(p);
  });

  // ── Añadir paso ──
  document.getElementById('stepAddForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('stepInput');
    const text  = input.value.trim();
    if (!text) return;
    const p = getProject(state.activeProjectId);
    if (!p) return;
    p.steps = [...(p.steps || []), { id: uid(), text, done: false }];
    await saveProject(p);
    input.value = '';
  });

  // ── Añadir mañana ──
  document.getElementById('tomorrowAddForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = document.getElementById('tomorrowInput');
    const text  = input.value.trim();
    if (!text) return;
    const p = getProject(state.activeProjectId);
    if (!p) return;
    p.tomorrow = [...(p.tomorrow || []), { id: uid(), text }];
    await saveProject(p);
    input.value = '';
  });

  // ── Exportar día ──
  document.getElementById('btnExport').addEventListener('click', () => {
    const p = getProject(state.activeProjectId);
    if (!p) return;
    const date    = formatDateES();
    const pending = (p.steps || []).filter(s => !s.done).map(s => `- [ ] ${s.text}`).join('\n') || '  (sin pasos pendientes)';
    const done    = (p.steps || []).filter(s => s.done).map(s => `- [x] ${s.text}`).join('\n') || '';
    const tmrw    = (p.tomorrow || []).map(t => `- ${t.text}`).join('\n') || '  (sin acciones para mañana)';
    const text    = `# ${p.emoji} ${p.name} — ${date}\nProgreso: ${p.progress ?? 0}%\n\n## Pasos pendientes\n${pending}\n${done ? `\n## Completados\n${done}` : ''}\n\n## Acciones para mañana\n${tmrw}`;
    navigator.clipboard.writeText(text).then(() => showToast('Resumen copiado al portapapeles ✓'));
    p.tomorrow = [];
    saveProject(p);
  });
});

// ── Mensajes de error amigables ──────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found':      'No existe ninguna cuenta con ese correo.',
    'auth/wrong-password':      'Contraseña incorrecta.',
    'auth/invalid-email':       'El correo no es válido.',
    'auth/email-already-in-use':'Ya existe una cuenta con ese correo.',
    'auth/weak-password':       'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests':   'Demasiados intentos fallidos. Inténtalo más tarde.',
    'auth/invalid-credential':  'Correo o contraseña incorrectos.',
  };
  return map[code] || 'Error al autenticar. Inténtalo de nuevo.';
}