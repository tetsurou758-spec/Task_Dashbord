// 設定画面ロジック
let keywords = ['お願いします', 'ご対応', '確認してください', '対応お願い', 'よろしくお願い'];

function renderKeywords() {
  const area = document.getElementById('keyword-area');
  if (keywords.length === 0) {
    area.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted)">キーワードがありません</span>';
    return;
  }
  area.innerHTML = keywords.map((kw, i) => `
    <span class="keyword-tag">
      ${kw}
      <button onclick="removeKeyword(${i})" title="削除">✕</button>
    </span>
  `).join('');
}

function removeKeyword(i) {
  keywords.splice(i, 1);
  renderKeywords();
}

document.getElementById('btn-add-keyword').addEventListener('click', addKeyword);
document.getElementById('new-keyword').addEventListener('keydown', e => {
  if (e.key === 'Enter') addKeyword();
});

function addKeyword() {
  const input = document.getElementById('new-keyword');
  const val = input.value.trim();
  if (val && !keywords.includes(val)) {
    keywords.push(val);
    renderKeywords();
  }
  input.value = '';
  input.focus();
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const tools = [...document.querySelectorAll('input[name="tool"]:checked')].map(el => el.value);

  const data = {
    tools,
    keywords,
    sync_interval_minutes: parseInt(document.getElementById('sync-interval').value),
    outlook_days_back: parseInt(document.getElementById('outlook-days-back').value),
    outlook_max_items: parseInt(document.getElementById('outlook-max-items').value),
  };
  try {
    await api.saveSettings(data);
    showToast('✅ 設定を保存しました');
  } catch (e) {
    showToast('⚠️ 保存に失敗しました（バックエンド未起動）');
  }
});

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

async function init() {
  try {
    const s = await api.getSettings();
    if (s.keywords && s.keywords.length) keywords = s.keywords;
    if (s.tools) {
      document.querySelectorAll('input[name="tool"]').forEach(el => {
        el.checked = s.tools.includes(el.value);
      });
    }
    if (s.sync_interval_minutes) {
      document.getElementById('sync-interval').value = s.sync_interval_minutes;
    }
    if (s.outlook_days_back) {
      document.getElementById('outlook-days-back').value = s.outlook_days_back;
    }
    if (s.outlook_max_items) {
      document.getElementById('outlook-max-items').value = s.outlook_max_items;
    }
  } catch { /* バックエンド未起動時はデフォルト値を使用 */ }

  renderKeywords();
}

init();
