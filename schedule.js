const SHEET_ID_TIMETABLE = '11yaPysnuMfkXtwvZSOOohogKnvT0py7rWuKNyAs5ud8';
const SCHEDULE_INDEX_GID = 887181046;

const DAYS = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье'
];

let scheduleIndex = [];
let parsed = {};
let activeDay = null;
let activePool = 'big';

const content = document.getElementById('scheduleContent');
const dayTabs = document.getElementById('dayTabs');
const titleEl = document.getElementById('title');
const poolButtons = document.querySelectorAll('[data-pool]');

init();

/* ================= INIT ================= */

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

  if (scheduleIndex.length === 0) {
    await loadIndex();
  }

  const entry = findMonth();
  if (!entry || !entry[activePool]) {
    content.textContent = 'Нет расписания на этот месяц';
    return;
  }

  const rows = await fetchCSV(entry[activePool]);
  parsed = parseLaneSchedule(rows);

  const today = getCurrentWeekDay();
  activeDay = parsed[today] ? today : Object.keys(parsed)[0];

  renderDayTabs();
  renderDay();
}

/* ================= FETCH ================= */

async function loadIndex() {
  const text = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID_TIMETABLE}/export?format=csv&gid=${SCHEDULE_INDEX_GID}`
  ).then(r => r.text());

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

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

/* ================= PARSER ================= */

function parseLaneSchedule(rows) {
  const result = {};

  const timeRowIndex = rows.findIndex(r =>
    r[0] && r[0].toLowerCase().includes('время')
  );
  if (timeRowIndex === -1) return result;

  const times = [];
  const timeCols = [];

  rows[timeRowIndex].forEach((cell, col) => {
    if (/\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/.test(cell)) {
      times.push(cell.trim());
      timeCols.push(col);
    }
  });

  for (let i = timeRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;

    if (DAYS.includes(row[0])) {
      const day = row[0];
      result[day] = times.map(t => ({ time: t, lanes: [] }));

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

      i = r - 1;
    }
  }

  return result;
}

/* ================= RENDER ================= */

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
    const total = slot.lanes.length;
    const free = slot.lanes.filter(l => !l.busy).length;
    const isNow = isNowInSlot(slot.time);

    const lanesHtml = slot.lanes.map(l =>
      `<span class="lane ${l.busy ? 'busy' : 'free'}">${l.lane}</span>`
    ).join('');

    const div = document.createElement('div');
    div.className = `slot${isNow ? ' now' : ''}`;

    div.innerHTML = `
      <div class="time">
        ${slot.time}
        <span class="count">Свободно: ${free}/${total}</span>
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

/* ================= HELPERS ================= */

function getCurrentMonth() {
  const d = new Date();
  return d.toLocaleString('ru-RU', { month: 'long' })
    .replace(/^./, c => c.toUpperCase()) + ' ' + d.getFullYear();
}

function getCurrentWeekDay() {
  return DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
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

function normalize(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findMonth() {
  const cur = normalize(getCurrentMonth());
  return scheduleIndex.find(m => normalize(m.month) === cur);
}
