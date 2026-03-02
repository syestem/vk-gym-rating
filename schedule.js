const SHEET_ID_TIMETABLE = '11yaPysnuMfkXtwvZSOOohogKnvT0py7rWuKNyAs5ud8';
const SCHEDULE_INDEX_GID = 887181046;

let scheduleIndex = [];
let parsed = {};
let activeDay = null;
let activePool = 'big';

const content = document.getElementById('scheduleContent');
const dayTabs = document.getElementById('dayTabs');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const poolButtons = document.querySelectorAll('[data-pool]');

init();

async function init() {
  titleEl.textContent = getCurrentMonth();
  backBtn.onclick = () => history.back();

  poolButtons.forEach(btn => {
    btn.onclick = () => {
      poolButtons.forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
      activePool = btn.dataset.pool;
      init();
    };
  });

  await loadIndex();
  const entry = findMonth();

  if (!entry || !entry[activePool]) {
    content.textContent = 'Нет данных по выбранному бассейну';
    return;
  }

  const rows = await fetchCSV(entry[activePool]);
  parsed = parseLaneSchedule(rows);

  renderDayTabs();
  activeDay = Object.keys(parsed)[0];
  renderDay();
}

async function loadIndex() {
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

/* ===== PARSER ===== */
function parseLaneSchedule(rows) {
  const DAYS = [
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
    'Воскресенье'
  ];

  const result = {};

  // 1. Время (строка "время на воде")
  const timeRow = rows.find(r =>
    r[0] && r[0].toLowerCase().includes('время')
  );

  if (!timeRow) return result;

  // Берём только реальные временные слоты (C..W)
  const times = timeRow
    .slice(2)
    .filter(t => /\d{1,2}:\d{2}/.test(t));

  let i = 0;
  while (i < rows.length) {
    const row = rows[i];

    // 2. Начало дня
    if (row[0] && DAYS.includes(row[0])) {
      const day = row[0];
      result[day] = times.map(t => ({
        time: t,
        lanes: []
      }));

      // 3. Следующие 6 строк — дорожки
      for (let l = 1; l <= 6; l++) {
        const laneRow = rows[i + l];
        const laneNumber = Number(laneRow[1]);
        if (!laneNumber) continue;

        times.forEach((_, tIndex) => {
          const cell = laneRow[tIndex + 2];
          result[day][tIndex].lanes.push({
            lane: laneNumber,
            busy: Boolean(cell && cell.trim())
          });
        });
      }

      i += 7; // перескакиваем блок дня
      continue;
    }

    i++;
  }

  return result;
}

/* ===== RENDER ===== */
function renderDayTabs() {
  dayTabs.innerHTML = '';
  Object.keys(parsed).forEach(day => {
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

function renderDay() {
  content.innerHTML = '';
  parsed[activeDay].forEach(slot => {
    const div = document.createElement('div');
    div.className = 'slot';

    const lanes = slot.lanes.map(l =>
      `<span class="lane ${l.busy ? 'busy' : 'free'}">${l.lane}</span>`
    ).join('');

    div.innerHTML = `
      <div class="time">${slot.time}</div>
      <div class="lanes">${lanes}</div>
    `;
    content.appendChild(div);
  });
}

/* ===== HELPERS ===== */
function isDay(s) {
  return /Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье/.test(s);
}

function getCurrentMonth() {
  const d = new Date();
  return d.toLocaleString('ru-RU', { month: 'long' }).replace(/^./, c => c.toUpperCase()) + ' ' + d.getFullYear();
}

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findMonth() {
  const cur = normalize(getCurrentMonth());
  return scheduleIndex.find(m => normalize(m.month) === cur);
}
