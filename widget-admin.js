const APP_ID = 54462205;
let isAdmin = false;

if (typeof vkBridge !== 'undefined') {
  vkBridge.send('VKWebAppGetLaunchParams')
    .then(params => {
      if (
        params.vk_viewer_group_role === 'admin' ||
        params.vk_viewer_group_role === 'editor'
      ) {
        isAdmin = true;
        document.getElementById('updateWidgetBtn').style.display = 'block';
      }
    })
    .catch(() => {});
}

document
  .getElementById('updateWidgetBtn')
  ?.addEventListener('click', async () => {
    if (!isAdmin) return;
    if (!confirm('Обновить виджет?')) return;

    try {
      const auth = await vkBridge.send('VKWebAppGetAuthToken', {
        app_id: APP_ID,
        scope: 'groups'
      });

      const payload = buildWidgetPayload();
      await updateWidget(auth.access_token, payload);

      alert('Виджет обновлён');
    } catch (e) {
      console.error(e);
      alert('Ошибка обновления виджета');
    }
  });

function buildWidgetPayload() {
  return {
    title: 'Рейтинг посещаемости',
    rows: allData
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((r, i) => [String(i + 1), r.name, String(r.total)]),
    button: {
      text: 'Открыть полностью',
      url: 'https://vk.com/app54462205'
    }
  };
}

async function updateWidget(token, payload) {
  const url =
    'https://api.vk.com/method/appWidgets.update' +
    '?type=table' +
    '&code=' + encodeURIComponent(JSON.stringify(payload)) +
    '&access_token=' + token +
    '&v=5.199';

  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw json.error;
}
