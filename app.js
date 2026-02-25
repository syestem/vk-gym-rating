vkBridge.send('VKWebAppInit');

vkBridge.subscribe(e => {
  if (e.detail.type === 'VKWebAppUpdateConfig') {
    document.body.classList.toggle(
      'dark',
      e.detail.data.scheme.includes('dark')
    );
  }
});

const SHEET_ID = '1fz_CeBp5yXH3qwvgYGQXY77nHZXoq3JMn6BqPZQ--Og';

const tbody = document.getElementById('tbody');
const loader = document.getElementById('loader');
const monthSelect = document.getElementById('monthSelect');
const facultySelect = document.getElementById('facultySelect');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

let months = [];
let monthIndex = 0;
let allData = [];
let visibleCount = 30;
let abortController = null;

// ---------- МЕСЯЦЫ ----------
fetch('./months.json')
  .then(r => r.json())
  .then(json => {
    months = Object.entries(json);

    months.forEach(([name], i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = name;
      monthSelect.appendChild(o);
    });

    // 1. пытаемся восстановить сохранённый месяц
const savedRaw = localStorage.getItem('monthIndex');
let restored = false;

if (savedRaw !== null) {
  const saved = Number(savedRaw);
  if (!Number.isNaN(saved) && saved >= 0 && saved < months.length) {
    monthIndex = saved;
    restored = true;
  }
}

// 2. если сохранённого нет — определяем текущий месяц
if (!restored) {
  const now = new Date();
  const ruMonth = now.toLocaleString('ru-RU', { month: 'long' });
  const ruYear = now.getFullYear();
  const autoName =
    ruMonth.charAt(0).toUpperCase() + ruMonth.slice(1) + ' ' + ruYear;

  const found = months.findIndex(m => m[0] === autoName);
  monthIndex = found >= 0 ? found : months.length - 1;
}

// 3. запускаем загрузку
monthSelect.value = monthIndex;
loadMonth();
  });

// ---------- НАВИГАЦИЯ ----------
prevBtn.onclick = () => changeMonth(-1);
nextBtn.onclick = () => changeMonth(1);
monthSelect.onchange = () => {
  monthIndex = Number(monthSelect.value);
  loadMonth();
};

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') changeMonth(-1);
  if (e.key === 'ArrowRight') changeMonth(1);
});

function changeMonth(delta) {
  const next = monthIndex + delta;
  if (next < 0 || next >= months.length) return;
  monthIndex = next;
  monthSelect.value = monthIndex;
  loadMonth();
}

// ---------- ЗАГРУЗКА ----------
function loadMonth() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  document.body.classList.add('loading');
  loader.innerHTML = '<div class="spinner"></div>';

  prevBtn.disabled = nextBtn.disabled = monthSelect.disabled = facultySelect.disabled = true;
  localStorage.setItem('monthIndex', monthIndex);

  allData = [];
  visibleCount = 30;
  tbody.innerHTML = '';
  facultySelect.innerHTML = '<option value="all">Все факультеты</option>';

  const gid = months[monthIndex][1];

  fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
    { signal: abortController.signal }
  )
    .then(r => r.text())
    .then(text => parseCSV(text))
    .finally(() => {
      document.body.classList.remove('loading');
      loader.innerHTML = '';
      prevBtn.disabled = nextBtn.disabled = monthSelect.disabled = facultySelect.disabled = false;
    });
}

// ---------- CSV ----------
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  const faculties = new Set();

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (!c[0]?.startsWith('https://vk.com')) continue;

    allData.push({
      vkUrl: c[0],
      name: c[1],
      faculty: c[2],
      gym: +c[3],
      pool: +c[4],
      total: +c[5]
    });

    faculties.add(c[2]);
  }

  faculties.forEach(f => {
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f;
    facultySelect.appendChild(o);
  });

  render(true);
}

// ---------- РЕНДЕР ----------
facultySelect.onchange = () => render(true);

function render(reset = false) {
  if (reset) tbody.innerHTML = '';

  const faculty = facultySelect.value;
  const data = allData
    .filter(r => faculty === 'all' || r.faculty === faculty)
    .sort((a, b) => b.total - a.total);

  data.slice(0, visibleCount).forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === 0) tr.classList.add('top-1');
    if (i === 1) tr.classList.add('top-2');
    if (i === 2) tr.classList.add('top-3');

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="name"><a href="${r.vkUrl}" target="_blank">${r.name}</a></td>
      <td>${r.faculty}</td>
      <td>${r.gym}</td>
      <td>${r.pool}</td>
      <td><b>${r.total}</b></td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- LAZY LOAD ----------
window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    visibleCount += 20;
    render();
  }
});
