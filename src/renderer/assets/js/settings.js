// 設定画面ロジック
let keywords = [];

function renderKeywords() {
  const el = document.getElementById('keyword-list');
  el.innerHTML = keywords.map((kw, i) => `
    <span class="keyword-tag">
      ${kw}
      <button onclick="removeKeyword(${i})">×</button>
    </span>
  `).join('');
}

function removeKeyword(i) {
  keywords.splice(i, 1);
  renderKeywords();
}

document.getElementById('btn-add-keyword').addEventListener('click', () => {
  const input = document.getElementById('new-keyword');
  const val = input.value.trim();
  if (val && !keywords.includes(val)) {
    keywords.push(val);
    renderKeywords();
    input.value = '';
  }
});

document.getElementById('btn-save').addEventListener('click', async () => {
  const tools = [...document.querySelectorAll('input[name="tool"]:checked')].map(el => el.value);
  const data = {
    tools,
    keywords,
    sync_interval_minutes: parseInt(document.getElementById('sync-interval').value),
  };
  await api.saveSettings(data);
  alert('設定を保存しました');
});

// 設定読み込み
async function init() {
  try {
    const settings = await api.getSettings();
    keywords = settings.keywords || [];
    renderKeywords();
    settings.tools.forEach(t => {
      const el = document.querySelector(`input[value="${t}"]`);
      if (el) el.checked = true;
    });
    document.getElementById('sync-interval').value = settings.sync_interval_minutes;
  } catch { /* バックエンド未起動時はデフォルト値のまま */ }
}

init();
