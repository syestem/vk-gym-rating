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
  titleEl.textContent = `Расписание бассейна на ${getCurrentMonth()}`;
  
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
  for (const gid of gids) {
    if (gid === SCHEDULE_INDEX_GID) continue;

    const rows = await fetchCSV(gid);
  // расчёт суммы
  }
  parsed = parseLaneSchedule(rows);

  renderDayTabs();
  const today = getCurrentWeekDay();
  activeDay = parsed[today] ? today : Object.keys(parsed)[0];
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
  if (gid === SCHEDULE_INDEX_GID) return [];

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

  // 1. Находим строку "время на воде"
  const timeRowIndex = rows.findIndex(r =>
    r[0] && r[0].toLowerCase().includes('время')
  );
  if (timeRowIndex === -1) return result;

  // 2. Определяем временные колонки (по шаблону 6:25-7:10)
  const times = [];
  const timeCols = [];

  rows[timeRowIndex].forEach((cell, col) => {
    if (/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/.test(cell)) {
      times.push(cell.trim());
      timeCols.push(col);
    }
  });

  // 3. Идём построчно, без прыжков
  for (let i = timeRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;

    if (DAYS.includes(row[0])) {
      const day = row[0];
      result[day] = times.map(t => ({ time: t, lanes: [] }));

      // 4. Читаем строки дорожек до следующего дня
      let r = i + 1;
      while (r < rows.length && !DAYS.includes(rows[r]?.[0])) {
        const lane = Number(rows[r]?.[1]);
        if (lane) {
          timeCols.forEach((col, idx) => {
            const cell = rows[r][col];
            result[day][idx].lanes.push({
              lane,
              busy: Boolean(cell && cell.trim())
            });
          });
        }
        r++;
      }

      i = r - 1; // продолжаем с конца блока
    }
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
    const freeCount = slot.lanes.filter(l => !l.busy).length;

    const lanesHtml = slot.lanes.map(l =>
      `<span class="lane ${l.busy ? 'busy' : 'free'}">${l.lane}</span>`
    ).join('');

    const div = document.createElement('div');
    const isNow = isNowInSlot(slot.time);

    div.className = `slot${isNow ? ' now' : ''}`;

    div.innerHTML = `
      <div class="time">
        ${slot.time}
        <span class="count">Свободно: ${freeCount}/${slot.lanes.length}</span>
      </div>
      <div class="lanes">${lanesHtml}</div>
    `;

    content.appendChild(div);
    
  });
  setTimeout(() => {
  const nowSlot = document.querySelector('.slot.now');
  if (nowSlot) {
    nowSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}, 0);
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
function getCurrentWeekDay() {
  const map = [
    'Воскресенье',
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота'
  ];
  return map[new Date().getDay()];
}
function isNowInSlot(slotTime) {
  const now = new Date();

  const [start, end] = slotTime.split('-').map(t => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  });

  return now >= start && now <= end;
}
