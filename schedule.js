/* ===============================
   CONFIG
================================ */
const SHEET_ID_TIMETABLE = '11yaPysnuMfkXtwvZSOOohogKnvT0py7rWuKNyAs5ud8';
const SCHEDULE_INDEX_GID = 887181046;

/* ===============================
   STATE
================================ */
let scheduleIndex = [];
let parsedSchedule = {};
let activeDay = null;
let activePool = 'big';

/* ===============================
   DOM
================================ */
const content = document.getElementById('scheduleContent');
const dayTabs = document.getElementById('dayTabs');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const poolButtons = document.querySelectorAll('[data-pool]');

/* ===============================
   INIT
================================ */
init();

async function init() {
  titleEl.textContent = getCurrentMonth();
  bindUI();

  await loadScheduleIndex();
  const entry = findCurrentMonthEntry();

  if (!entry) {
    content.textContent = 'Нет расписания на этот месяц';
    return;
  }

  const gid = entry[activePool];
  if (!gid) {
    content.textContent = 'Нет данных по выбранному бассейну';
    return;
  }

  const rows = await fetchCSV(gid);
  parsedSchedule = parseSchedule(rows);

  renderDayTabs();
  setDefaultDay();
  renderDay();
}

/* ===============================
   UI
================================ */
function bindUI() {
  backBtn.onclick = () => history.back();

  poolButtons.forEach(btn => {
    btn.onclick = () => {
      poolButtons.forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      activePool = btn.dataset.pool;
      init(); // перезагружаем под другой бассейн
    };
  });
}

/* ===============================
   DATA LOAD
================================ */
async function loadScheduleIndex() {
  const text = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID_TIMETABLE}/export?format=csv&gid=${SCHEDULE_INDEX_GID}`
  ).then(r => r.text());

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  scheduleIndex = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (!c[0]) continue;

    scheduleIndex.push({
      month: c[0].trim(),
      big: c[1] ? Number(c[1]) : null,
      small: c[2] ? Number(c[2]) : null
    });
  }
}

async function fetchCSV(gid) {
  const text = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID_TIMETABLE}/export?format=csv&gid=${gid}`
  ).then(r => r.text());

  return text.replace(/^\uFEFF/, '').split(/\r?\n/).map(r => r.split(','));
}

/* ===============================
   PARSER
================================ */
function parseSchedule(rows) {
  const days = rows[0].slice(1); // заголовки дней
  const result = {};
  days.forEach(d => result[d] = []);

  for (let i = 1; i < rows.length; i++) {
    const time = rows[i][0];
    if (!time) continue;

    for (let d = 0; d < days.length; d++) {
      const cell = rows[i][d + 1]?.trim();
      result[days[d]].push({
        time,
        busy: Boolean(cell),
        raw: cell || ''
      });
    }
  }
  return result;
}

/* ===============================
   RENDER
================================ */
function renderDayTabs() {
  dayTabs.innerHTML = '';
  Object.keys(parsedSchedule).forEach(day => {
    const btn = document.createElement('button');
    btn.textContent = day;
    btn.className = day === activeDay ? 'active' : '';
    btn.onclick = () => {
      activeDay = day;
      renderDayTabs();
      renderDay();
    };
    dayTabs.appendChild(btn);
  });
}

function setDefaultDay() {
  activeDay = Object.keys(parsedSchedule)[0];
}

function renderDay() {
  content.innerHTML = '';

  parsedSchedule[activeDay].forEach(slot => {
    const div = document.createElement('div');
    div.className = `slot ${slot.busy ? 'busy' : 'free'}`;
    div.innerHTML = `
      <div class="time">${slot.time}</div>
      <div class="status">
        ${slot.busy ? '🔴 ЗАНЯТО' : '🟢 СВОБОДНО'}
      </div>
    `;
    content.appendChild(div);
  });
}

/* ===============================
   HELPERS
================================ */
function getCurrentMonth() {
  const d = new Date();
  return (
    d.toLocaleString('ru-RU', { month: 'long' })
      .replace(/^./, c => c.toUpperCase()) +
    ' ' + d.getFullYear()
  );
}

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findCurrentMonthEntry() {
  const current = normalize(getCurrentMonth());
  return scheduleIndex.find(m => normalize(m.month) === current);
}
