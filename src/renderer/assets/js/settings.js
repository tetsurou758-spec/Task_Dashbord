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

  // Anthropic API Key はlocalStorageに保存（バックエンドに送らない）
  const apiKey = document.getElementById('anthropic-api-key').value.trim();
  if (apiKey) {
    localStorage.setItem('task_dashbord_anthropic_key', apiKey);
    updateLlmStatus(true);
  } else {
    localStorage.removeItem('task_dashbord_anthropic_key');
    updateLlmStatus(false);
  }

  const data = {
    tools,
    keywords,
    sync_interval_minutes: parseInt(document.getElementById('sync-interval').value),
    azure: {
      client_id: document.getElementById('azure-client-id').value,
      tenant_id: document.getElementById('azure-tenant-id').value,
    },
    slack: {
      team_id: document.getElementById('slack-team-id').value,
    },
  };
  try {
    await api.saveSettings(data);
  } catch { /* バックエンド未起動でも続行 */ }
  showToast('✅ 設定を保存しました');
});

function updateLlmStatus(enabled) {
  const el = document.getElementById('llm-status');
  if (!el) return;
  el.textContent = enabled ? '✅ AI本文抽出：有効（スクラップ時に自動適用）' : '— 未設定（ヒューリスティック抽出のみ）';
  el.style.color = enabled ? '#43a047' : 'var(--text-muted)';
}

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
    s.tools?.forEach(tool => {
      const el = document.querySelector(`input[value="${tool}"]`);
      if (el) el.checked = true;
    });
    if (s.sync_interval_minutes) {
      document.getElementById('sync-interval').value = s.sync_interval_minutes;
    }
  } catch { /* バックエンド未起動時はデフォルト値を使用 */ }

  // Anthropic API Key をlocalStorageから復元（表示はマスク）
  const savedKey = localStorage.getItem('task_dashbord_anthropic_key') || '';
  if (savedKey) {
    document.getElementById('anthropic-api-key').placeholder = '設定済み（変更する場合は入力）';
    updateLlmStatus(true);
  } else {
    updateLlmStatus(false);
  }

  renderKeywords();
}

init();
