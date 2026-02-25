vkBridge.send('VKWebAppInit');

/* ---------- VK THEME ---------- */
vkBridge.subscribe(e => {
  if (e.detail.type === 'VKWebAppUpdateConfig') {
    document.body.classList.toggle(
      'dark',
      e.detail.data.scheme.includes('dark')
    );
  }
});

/* ---------- CONSTANTS ---------- */
const SHEET_ID = '1fz_CeBp5yXH3qwvgYGQXY77nHZXoq3JMn6BqPZQ--Og';

const tbody = document.getElementById('tbody');
const loader = document.getElementById('loader');
const monthSelect = document.getElementById('monthSelect');
const facultySelect = document.getElementById('facultySelect');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const allTimeBtn = document.getElementById('allTime');
const activeMonthEl = document.getElementById('activeMonth');

/* ---------- STATE ---------- */
let months = [];
let monthIndex = 0;
let allData = [];
let visibleCount = 30;
let abortController = null;
let mode = 'month'; // 'month' | 'all'
let selectedFaculty = 'all';

/* ---------- LOAD MONTHS ---------- */
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

    // текущий календарный месяц
    const now = new Date();
    const ruMonth = now.toLocaleString('ru-RU', { month: 'long' });
    const ruYear = now.getFullYear();
    const currentName =
      ruMonth.charAt(0).toUpperCase() + ruMonth.slice(1) + ' ' + ruYear;

    const found = months.findIndex(m => m[0] === currentName);

    const saved = Number(localStorage.getItem('monthIndex'));
    if (!Number.isNaN(saved) && saved >= 0 && saved < months.length) {
      monthIndex = saved;
    } else {
      monthIndex = found >= 0 ? found : months.length - 1;
    }

    monthSelect.value = monthIndex;
    loadMonth();
  });

/* ---------- NAVIGATION ---------- */
prevBtn.onclick = () => {
  if (mode !== 'month') return;
  changeMonth(-1);
};

nextBtn.onclick = () => {
  if (mode !== 'month') return;
  changeMonth(1);
};

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

/* ---------- LOAD ONE MONTH ---------- */
function loadMonth() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  document.body.classList.add('loading');
  loader.innerHTML = '<div class="spinner"></div>';

  selectedFaculty = facultySelect.value;

  tbody.innerHTML = '';
  facultySelect.innerHTML = '<option value="all">Все факультеты</option>';
  allData = [];
  visibleCount = 30;

  activeMonthEl.textContent = months[monthIndex][0];
  localStorage.setItem('monthIndex', monthIndex);

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
    });
}

/* ---------- LOAD ALL TIME ---------- */
async function loadAllTime() {
  if (abortController) abortController.abort();
  abortController = new AbortController();

  document.body.classList.add('loading');
  loader.innerHTML = '<div class="spinner"></div>';

  selectedFaculty = facultySelect.value;

  tbody.innerHTML = '';
  facultySelect.innerHTML = '<option value="all">Все факультеты</option>';
  allData = [];
  visibleCount = 30;

  activeMonthEl.textContent = 'За всё время';

  const map = new Map();

  for (const [, gid] of months) {
    const text = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
    ).then(r => r.text());

    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      if (!c[0]?.startsWith('https://vk.com')) continue;

      const key = c[0];

      if (!map.has(key)) {
        map.set(key, {
          vkUrl: c[0],
          name: c[1],
          faculty: c[2],
          gym: 0,
          pool: 0,
          total: 0
        });
      }

      const item = map.get(key);
      item.gym += +c[3];
      item.pool += +c[4];
      item.total += +c[5];
      item.faculty = c[2]; // последний факультет
    }
  }

  allData = Array.from(map.values());
  rebuildFaculties();
  render(true);

  document.body.classList.remove('loading');
  loader.innerHTML = '';
}

/* ---------- CSV ---------- */
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

  rebuildFaculties(faculties);
  render(true);
}

/* ---------- FACULTIES ---------- */
function rebuildFaculties(set) {
  const faculties = set || new Set(allData.map(r => r.faculty));
  facultySelect.innerHTML = '<option value="all">Все факультеты</option>';

  faculties.forEach(f => {
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f;
    facultySelect.appendChild(o);
  });

  if ([...faculties].includes(selectedFaculty)) {
    facultySelect.value = selectedFaculty;
  } else {
    facultySelect.value = 'all';
    selectedFaculty = 'all';
  }
}

/* ---------- RENDER ---------- */
facultySelect.onchange = () => {
  selectedFaculty = facultySelect.value;
  render(true);
};

function render(reset = false) {
  if (reset) tbody.innerHTML = '';

  const data = allData
    .filter(r => selectedFaculty === 'all' || r.faculty === selectedFaculty)
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

/* ---------- LAZY LOAD ---------- */
window.addEventListener('scroll', () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
    visibleCount += 20;
    render();
  }
});
