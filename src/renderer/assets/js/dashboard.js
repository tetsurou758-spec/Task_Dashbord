// ダッシュボード画面ロジック
let currentPriority = 'all';
let currentNewsCategory = 'insurance';

// タスク一覧を描画
function renderTasks(tasks) {
  const list = document.getElementById('task-list');
  const filtered = currentPriority === 'all' ? tasks : tasks.filter(t => t.priority === currentPriority);

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-message">タスクはありません</p>';
    return;
  }

  list.innerHTML = filtered.map(t => `
    <div class="task-card ${t.is_done ? 'done' : ''}" data-priority="${t.priority}" data-url="${t.source_url}" onclick="openSource('${t.source_url}')">
      <div class="task-card-header">
        <span class="task-subject">${t.subject}</span>
        <span class="task-source-badge">${sourceLabel(t.source)}</span>
      </div>
      <div class="task-meta">
        <span>${t.sender}</span>
        <span>${formatDate(t.received_at)}</span>
        <span class="priority-badge ${t.priority}">${priorityLabel(t.priority)}</span>
      </div>
      <div class="task-body">${t.body_snippet}</div>
    </div>
  `).join('');
}

// ニュースを描画
function renderNews(items) {
  const list = document.getElementById('news-list');
  if (!items || items.length === 0) {
    list.innerHTML = '<p class="empty-message">ニュースなし</p>';
    return;
  }
  list.innerHTML = items.map(n => `
    <div class="news-card" onclick="openSource('${n.url}')">
      <div class="news-title">${n.title}</div>
      <div class="news-source">${n.source} · ${formatDate(n.published_at)}</div>
    </div>
  `).join('');
}

// 元ソースを開く（Electron経由 or 通常ブラウザ）
function openSource(url) {
  if (window.electronAPI) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

// ユーティリティ
function sourceLabel(src) {
  return { outlook: '📧 Outlook', teams: '💬 Teams', slack: '🟢 Slack' }[src] || src;
}
function priorityLabel(p) {
  return { high: '🔴 高', medium: '🟡 中', low: '🟢 低' }[p] || p;
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// 初期化
async function init() {
  // タスク取得
  try {
    const data = await api.getTasks();
    renderTasks(data.tasks || []);
  } catch {
    document.getElementById('task-list').innerHTML = '<p class="empty-message">バックエンド未起動</p>';
  }

  // ニュース取得
  try {
    const data = await api.getNews(currentNewsCategory);
    renderNews(data.news || []);
  } catch {
    document.getElementById('news-list').innerHTML = '<p class="empty-message">ニュース取得失敗</p>';
  }
}

// フィルターボタン
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPriority = btn.dataset.priority;
    init();
  });
});

// ニュースタブ
document.querySelectorAll('.news-tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentNewsCategory = tab.dataset.cat;
    try {
      const data = await api.getNews(currentNewsCategory);
      renderNews(data.news || []);
    } catch { /* noop */ }
  });
});

// 同期ボタン
document.getElementById('btn-sync').addEventListener('click', async () => {
  document.getElementById('sync-status').textContent = '同期中...';
  await api.triggerSync();
  await init();
  document.getElementById('sync-status').textContent = `最終同期: ${new Date().toLocaleTimeString()}`;
});

// 設定ボタン
document.getElementById('btn-settings').addEventListener('click', () => {
  location.href = 'settings.html';
});

init();
