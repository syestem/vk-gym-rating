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
const MONTHS_SHEET_GID = 1410034609;

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
loadMonthsFromSheet();

function loadMonthsFromSheet() {
  abortController = new AbortController();

  fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${MONTHS_SHEET_GID}`,
    { signal: abortController.signal }
  )
    .then(r => r.text())
    .then(parseMonthsSheet);
}
function parseMonthsSheet(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  months = [];

  for (let i = 18; i < lines.length; i++) { // 19-я строка = index 18
    const c = lines[i].split(',');

    const name = c[7]?.trim(); // H
    const gid = c[8]?.trim();  // I

    if (!name || !gid) continue;

    months.push([name, Number(gid)]);
  }

  // наполняем select
  monthSelect.innerHTML = '';
  months.forEach(([name], i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = name;
    monthSelect.appendChild(o);
  });

  // всегда открываем первый лист
   monthIndex = 0;
   monthSelect.value = monthIndex;
   loadMonth();
}
function debounce(fn, delay = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
const debouncedLoadMonth = debounce(loadMonth, 150);
const debouncedLoadAllTime = debounce(loadAllTime, 150);
/* ===============================
   NAVIGATION
================================ */
prevBtn.onclick = () => changeMonth(-1);
nextBtn.onclick = () => changeMonth(1);

function changeMonth(delta) {
  const next = monthIndex + delta;
  if (next < 0 || next >= months.length) return;
  monthIndex = next;
  monthSelect.value = monthIndex;
  debouncedLoadMonth();
}
monthSelect.onchange = () => {
  monthIndex = Number(monthSelect.value);
  debouncedLoadMonth();
};
allTimeBtn.onclick = () => {
  debouncedLoadAllTime();
};
/* ===============================
   FETCH HELPERS
================================ */
function abortFetch() {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  loader.textContent = 'Загрузка…';
  tbody.innerHTML = '';
  document.body.classList.add('loading');
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

  // если выбранного факультета нет в месяце — оставляем выбор,
// но select визуально переводим в "Все факультеты"
if (!available.has(selectedFaculty)) {
  facultySelect.value = 'all';
} else {
  facultySelect.value = selectedFaculty;
}
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

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Нет данных за этот период</td></tr>';
    document.body.classList.remove('loading');
    return;
  }

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

  // 🔴 ВАЖНО: снимаем loading после успешного рендера
  document.body.classList.remove('loading');
}
