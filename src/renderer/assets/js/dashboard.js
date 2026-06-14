// ダッシュボード画面ロジック
let allTasks = [];
let currentPriority = 'all';
let currentSource = 'all';
let showDone = false;
let currentNewsCategory = 'insurance';
let selectedTask = null;

// ===== 時計 =====
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' }) + '  ' +
    now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ===== ユーティリティ =====
function sourceLabel(src) {
  return { outlook: '📧 Outlook', teams: '💬 Teams', slack: '🟢 Slack' }[src] || src;
}
function priorityLabel(p) {
  return { high: '🔴 高', medium: '🟡 中', low: '🟢 低' }[p] || p;
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${d.getMonth()+1}/${d.getDate()}`;
}

// ===== サマリーバー更新 =====
function updateSummary(tasks) {
  document.getElementById('count-high').textContent   = tasks.filter(t => !t.is_done && t.priority === 'high').length;
  document.getElementById('count-medium').textContent = tasks.filter(t => !t.is_done && t.priority === 'medium').length;
  document.getElementById('count-low').textContent    = tasks.filter(t => !t.is_done && t.priority === 'low').length;
  document.getElementById('count-done').textContent   = tasks.filter(t => t.is_done).length;
}

// ===== タスク描画 =====
function renderTasks() {
  const list = document.getElementById('task-list');
  let filtered = allTasks.filter(t => {
    if (!showDone && t.is_done) return false;
    if (currentPriority !== 'all' && t.priority !== currentPriority) return false;
    if (currentSource !== 'all' && t.source !== currentSource) return false;
    return true;
  });

  // 未完了→完了の順、優先度順
  filtered.sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-message"><span class="empty-icon">✅</span>該当するタスクはありません</div>`;
    return;
  }

  list.innerHTML = filtered.map((t, i) => `
    <div class="task-card ${t.is_done ? 'is-done' : ''}" data-priority="${t.priority}" data-id="${t.id}"
         style="animation-delay:${i * 30}ms" onclick="openModal('${t.id}')">
      <div class="task-card-header">
        <div class="task-check" onclick="event.stopPropagation(); toggleDone('${t.id}')">
          ${t.is_done ? '<span class="task-check-inner">✓</span>' : ''}
        </div>
        <div class="task-content">
          <div class="task-top">
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
      </div>
    </div>
  `).join('');
}

// ===== 完了トグル =====
function toggleDone(id) {
  const task = allTasks.find(t => t.id === id);
  if (task) { task.is_done = !task.is_done; }
  updateSummary(allTasks);
  renderTasks();
}

// ===== モーダル =====
function openModal(id) {
  selectedTask = allTasks.find(t => t.id === id);
  if (!selectedTask) return;
  const t = selectedTask;
  document.getElementById('modal-source-badge').textContent = sourceLabel(t.source);
  document.getElementById('modal-subject').textContent = t.subject;
  document.getElementById('modal-sender').textContent = '✉ ' + t.sender;
  document.getElementById('modal-date').textContent = '🕐 ' + formatDate(t.received_at);
  const pb = document.getElementById('modal-priority-badge');
  pb.textContent = priorityLabel(t.priority);
  pb.className = 'priority-badge ' + t.priority;
  document.getElementById('modal-body').textContent = t.body_snippet;
  document.getElementById('modal-reason').textContent = '🤖 AI判定: ' + t.priority_reason;
  document.getElementById('modal-open-source').onclick = () => openSource(t.source_url);
  const doneBtn = document.getElementById('modal-toggle-done');
  doneBtn.textContent = t.is_done ? '✅ 未対応に戻す' : '✅ 完了にする';
  doneBtn.onclick = () => { toggleDone(t.id); closeModal(); };
  document.getElementById('task-modal').style.display = 'flex';
}
function closeModal() {
  document.getElementById('task-modal').style.display = 'none';
  selectedTask = null;
}
document.getElementById('task-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ===== ニュース描画 =====
function renderNews(items) {
  const list = document.getElementById('news-list');
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="empty-message">ニュースを取得中...</div>';
    return;
  }
  list.innerHTML = items.map((n, i) => `
    <div class="news-card" style="animation-delay:${i*40}ms" onclick="openSource('${n.url}')">
      <div class="news-title">${n.title}</div>
      <div class="news-summary">${n.summary}</div>
      <div class="news-source">${n.source} · ${formatDate(n.published_at)}</div>
    </div>
  `).join('');
  document.getElementById('news-updated').textContent = '更新: ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
}

// ===== 外部リンクを開く =====
function openSource(url) {
  if (window.electronAPI) { window.electronAPI.openExternal(url); }
  else { window.open(url, '_blank'); }
}

// ===== データ取得 =====
async function loadTasks() {
  try {
    const data = await api.getTasks();
    allTasks = data.tasks && data.tasks.length > 0 ? data.tasks : DEMO_TASKS;
  } catch {
    allTasks = DEMO_TASKS;
  }
  updateSummary(allTasks);
  renderTasks();
}

async function loadNews() {
  try {
    const data = await api.getNews(currentNewsCategory);
    const items = data.news && data.news.length > 0 ? data.news : DEMO_NEWS[currentNewsCategory];
    renderNews(items);
  } catch {
    renderNews(DEMO_NEWS[currentNewsCategory] || []);
  }
}

// ===== フィルター =====
document.querySelectorAll('#priority-filters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#priority-filters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPriority = btn.dataset.priority;
    renderTasks();
  });
});
document.querySelectorAll('#source-filters .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#source-filters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSource = btn.dataset.source;
    renderTasks();
  });
});
document.getElementById('show-done').addEventListener('change', e => {
  showDone = e.target.checked;
  renderTasks();
});

// ===== ニュースタブ =====
document.querySelectorAll('.news-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentNewsCategory = tab.dataset.cat;
    loadNews();
  });
});

// ===== 同期ボタン =====
document.getElementById('btn-sync').addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync');
  btn.querySelector('span').textContent = '⏳';
  document.getElementById('sync-status').textContent = '同期中...';
  try { await api.triggerSync(); } catch { /* noop */ }
  await Promise.all([loadTasks(), loadNews()]);
  document.getElementById('sync-status').textContent = '最終同期: ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'});
  btn.querySelector('span').textContent = '🔄';
});

// ===== 設定ボタン =====
document.getElementById('btn-settings').addEventListener('click', () => {
  location.href = 'settings.html';
});

// ===== 初期化 =====
loadTasks();
loadNews();
