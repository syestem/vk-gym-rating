/* ===============================
   ENV & VK INIT (SAFE)
================================ */
const isVK = typeof window.vkBridge !== 'undefined';

if (isVK) {
  vkBridge.send('VKWebAppInit').catch(() => {});
  vkBridge.subscribe(e => {
    if (e.detail.type === 'VKWebAppUpdateConfig') {
      document.body.classList.toggle(
        'dark',
        e.detail.data.scheme.includes('dark')
      );
    }
  });
}

/* ===============================
   CONSTANTS & DOM
================================ */
const SHEET_ID = '1fz_CeBp5yXH3qwvgYGQXY77nHZXoq3JMn6BqPZQ--Og';

const tbody = document.getElementById('tbody');
const loader = document.getElementById('loader');
const monthSelect = document.getElementById('monthSelect');
const facultySelect = document.getElementById('facultySelect');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const allTimeBtn = document.getElementById('allTime');

const currentPeriodEl = document.getElementById('currentPeriod');
const activeViewEl = document.getElementById('activeView');

/* ===============================
   STATE
================================ */
let months = [];
let monthIndex = 0;
let allData = [];
let selectedFaculty = 'all';
let abortController = null;
let mode = 'month'; // month | all

/* ===============================
   CURRENT CALENDAR MONTH
================================ */
(function setCurrentPeriod() {
  const now = new Date();
  const ruMonth = now.toLocaleString('ru-RU', { month: 'long' });
  const ruYear = now.getFullYear();
  currentPeriodEl.textContent =
    ruMonth.charAt(0).toUpperCase() + ruMonth.slice(1) + ' ' + ruYear;
})();

/* ===============================
   LOAD MONTHS LIST
================================ */
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

    const saved = Number(localStorage.getItem('monthIndex'));
    if (!Number.isNaN(saved) && saved >= 0 && saved < months.length) {
      monthIndex = saved;
    } else {
      monthIndex = months.length - 1;
    }

    monthSelect.value = monthIndex;
    loadMonth();
  });

/* ===============================
   NAVIGATION
================================ */
prevBtn.onclick = () => mode === 'month' && changeMonth(-1);
nextBtn.onclick = () => mode === 'month' && changeMonth(1);

monthSelect.onchange = () => {
  mode = 'month';
  monthIndex = Number(monthSelect.value);
  loadMonth();
};

allTimeBtn.onclick = () => {
  mode = 'all';
  loadAllTime();
};

function changeMonth(delta) {
  const next = monthIndex + delta;
  if (next < 0 || next >= months.length) return;
  monthIndex = next;
  monthSelect.value = monthIndex;
  loadMonth();
}

/* ===============================
   FETCH HELPERS
================================ */
function abortFetch() {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  loader.textContent = 'Загрузка…';
  tbody.innerHTML = '';
}

function fetchCSV(gid) {
  return fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
    { signal: abortController.signal }
  ).then(r => r.text());
}

/* ===============================
   LOAD ONE MONTH
================================ */
function loadMonth() {
  abortFetch();
  activeViewEl.textContent = months[monthIndex][0];
  localStorage.setItem('monthIndex', monthIndex);

  fetchCSV(months[monthIndex][1]).then(parseSingleMonth);
}

/* ===============================
   LOAD ALL TIME (AGGREGATION)
================================ */
async function loadAllTime() {
  abortFetch();
  activeViewEl.textContent = 'За всё время';

  const map = new Map();

  for (const [, gid] of months) {
    const text = await fetchCSV(gid);
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      if (!c[0]?.startsWith('https://vk.com')) continue;

      if (!map.has(c[0])) {
        map.set(c[0], {
          vkUrl: c[0],
          name: c[1],
          faculty: c[2],
          gym: 0,
          pool: 0,
          total: 0
        });
      }

      const row = map.get(c[0]);
      row.gym += +c[3];
      row.pool += +c[4];
      row.total += +c[5];
      row.faculty = c[2]; // последний факультет
    }
  }

  allData = Array.from(map.values());
  rebuildFaculties();
  render();
}

/* ===============================
   PARSE MONTH CSV
================================ */
function parseSingleMonth(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  allData = [];

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
  }

  rebuildFaculties();
  render();
}

/* ===============================
   FACULTIES
================================ */
function rebuildFaculties() {
  const available = new Set(allData.map(r => r.faculty));

  facultySelect.innerHTML = '<option value="all">Все факультеты</option>';
  available.forEach(f => {
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f;
    facultySelect.appendChild(o);
  });

  if (!available.has(selectedFaculty)) {
    selectedFaculty = 'all';
  }
  facultySelect.value = selectedFaculty;
}

facultySelect.onchange = () => {
  selectedFaculty = facultySelect.value;
  render();
};

/* ===============================
   RENDER
================================ */
function render() {
  loader.textContent = '';

  const data = allData
    .filter(r => selectedFaculty === 'all' || r.faculty === selectedFaculty)
    .sort((a, b) => b.total - a.total);

  tbody.innerHTML = '';
  data.forEach((r, i) => {
    const tr = document.createElement('tr');
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
