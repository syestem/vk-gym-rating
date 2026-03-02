const SHEET_ID_TIMETABLE = '11yaPysnuMfkXtwvZSOOohogKnvT0py7rWuKNyAs5ud8';
const SCHEDULE_INDEX_GID = 887181046;

let scheduleIndex = [];
let activeType = 'big';
let currentEntry = null;

const content = document.getElementById('scheduleContent');
const title = document.getElementById('scheduleTitle');
const buttons = document.querySelectorAll('[data-type]');

buttons.forEach(btn => {
  btn.onclick = () => {
    buttons.forEach(b => b.classList.remove('primary'));
    btn.classList.add('primary');
    activeType = btn.dataset.type;
    loadSchedule();
  };
});

init();

async function init() {
  await loadIndex();

  const now = new Date();
  const currentMonth =
    now.toLocaleString('ru-RU', { month: 'long' })
      .replace(/^./, c => c.toUpperCase()) +
    ' ' + now.getFullYear();

  const normalize = s => s.replace(/\s+/g, ' ').trim().toLowerCase();

  currentEntry = scheduleIndex.find(
    m => normalize(m.month) === normalize(currentMonth)
  );

  title.textContent = currentMonth;

  if (!currentEntry) {
    content.textContent = 'Нет расписания на этот месяц';
    return;
  }

  loadSchedule();
}

async function loadIndex() {
  const text = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID_TIMETABLE}/export?format=csv&gid=${SCHEDULE_INDEX_GID}`
  ).then(r => r.text());

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (!c[0]) continue;

    scheduleIndex.push({
      month: c[0],
      big: c[1] ? Number(c[1]) : null,
      small: c[2] ? Number(c[2]) : null
    });
  }
}

async function loadSchedule() {
  const gid = currentEntry[activeType];
  if (!gid) {
    content.textContent = 'Нет данных';
    return;
  }

  const text = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID_TIMETABLE}/export?format=csv&gid=${gid}`
  ).then(r => r.text());

  const rows = text.split(/\r?\n/);
  let html = '<table>';

  rows.forEach(r => {
    const c = r.split(',');
    html += '<tr>' + c.map(v => `<td>${v}</td>`).join('') + '</tr>';
  });

  html += '</table>';
  content.innerHTML = html;
}
