// ダッシュボード画面ロジック
let allTasks = [];
let currentPriority = 'all';
let currentSource = 'all';
let showDone = false;
let currentNewsCategory = 'insurance';
let currentNewsItems = [];  // 表示中のニュースを保持
let selectedTask = null;

// ===== 時計 =====
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' }) + '  ' +
    new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
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
  const diff = Date.now() - d;
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${d.getMonth()+1}/${d.getDate()}`;
}

// ===== サマリーバー =====
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
    if (currentSource   !== 'all' && t.source   !== currentSource)   return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
    return ({ high:0, medium:1, low:2 }[a.priority] ?? 3) - ({ high:0, medium:1, low:2 }[b.priority] ?? 3);
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-message"><span class="empty-icon">✅</span>該当するタスクはありません</div>`;
    return;
  }
  list.innerHTML = filtered.map((t, i) => `
    <div class="task-card ${t.is_done ? 'is-done' : ''}" data-priority="${t.priority}"
         style="animation-delay:${i*30}ms" data-id="${t.id}">
      <div class="task-card-header">
        <div class="task-check" data-check="${t.id}">
          ${t.is_done ? '<span class="task-check-inner">✓</span>' : ''}
        </div>
        <div class="task-content" data-open="${t.id}">
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

  // イベントをdata属性で委譲（URLをonclickに埋め込まない）
  list.querySelectorAll('[data-check]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); toggleDone(el.dataset.check); });
  });
  list.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => openModal(el.dataset.open));
  });
}

// ===== 完了トグル =====
function toggleDone(id) {
  const t = allTasks.find(t => t.id === id);
  if (t) t.is_done = !t.is_done;
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
  const openBtn = document.getElementById('modal-open-source');
  if (t.source === 'outlook' && t.id) {
    // Outlookメールは元メールをOutlookで開く
    openBtn.style.display = '';
    openBtn.textContent = '📧 Outlookで開く';
    openBtn.onclick = async () => {
      const r = await api.openMail(t.id);
      if (r.status !== 'ok') alert('メールを開けませんでした: ' + (r.message || ''));
    };
  } else if (t.source_url) {
    openBtn.style.display = '';
    openBtn.textContent = '🔗 元のメッセージを開く';
    openBtn.onclick = () => openSource(t.source_url);
  } else {
    openBtn.style.display = 'none';
    openBtn.onclick = null;
  }
  const doneBtn = document.getElementById('modal-toggle-done');
  doneBtn.textContent = t.is_done ? '↩ 未対応に戻す' : '✅ 完了にする';
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

// ===== ニュース描画（☆ボタン付き） =====
function renderNews(items) {
  currentNewsItems = items || [];
  const list = document.getElementById('news-list');
  if (!currentNewsItems.length) {
    list.innerHTML = '<div class="empty-message">ニュースを取得中...</div>';
    return;
  }

  list.innerHTML = currentNewsItems.map((n, i) => {
    const starred = window.scrapbook.isScraped(n.url);
    return `
      <div class="news-card" style="animation-delay:${i*40}ms" data-news-idx="${i}">
        <div class="news-card-top">
          <button class="star-btn ${starred ? 'starred' : ''}" data-news-idx="${i}" title="スクラップに追加">
            ${starred ? '★' : '☆'}
          </button>
          <div class="news-card-body" data-news-idx="${i}">
            <div class="news-title">${n.title}</div>
            <div class="news-summary">${n.summary || ''}</div>
            <div class="news-source">${n.source} · ${formatDate(n.published_at)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // ☆ボタン（スクラップ登録＋HTMLローカル保存）
  list.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const n = currentNewsItems[+btn.dataset.newsIdx];
      const saved = window.scrapbook.toggleScrap({ ...n, category: currentNewsCategory });
      btn.textContent = saved ? '★' : '☆';
      btn.classList.toggle('starred', saved);

      if (saved && window.electronAPI) {
        // Google News URLは暗号化のため本文取得をスキップ（RSSリード文をフォールバックとして使用）
        if (n.url && n.url.includes('news.google.com')) {
          window.scrapbook.updateTextError(n.url, 'gnews');
          btn.title = 'スクラップ済み（Google News経由：ブラウザで全文へ）';
        } else {
          btn.title = 'テキストを取得中...';
          const result = await window.electronAPI.fetchArticleText(n.url);
          if (result.ok) {
            window.scrapbook.updateTextContent(n.url, result.text);
            const methodLabel = { jsonld: 'JSON-LD', readability: 'Readability', heuristic: '段落抽出' };
            btn.title = `本文抽出済み（${methodLabel[result.method] || result.method}）`;
          } else {
            window.scrapbook.updateTextError(n.url, result.reason || 'error');
            btn.title = 'スクラップ済み（本文取得失敗）';
          }
        }
      } else if (!saved && window.electronAPI) {
        // ★解除時にローカルHTMLも削除
        const filepath = window.scrapbook.getHtmlPath(n.url);
        if (filepath) window.electronAPI.deleteArticleHtml(filepath);
        btn.title = 'スクラップに追加';
      }
    });
  });

  // カード本体クリックで元記事を開く
  list.querySelectorAll('.news-card-body').forEach(el => {
    el.addEventListener('click', () => {
      const n = currentNewsItems[+el.dataset.newsIdx];
      if (n) openSource(n.url);
    });
  });

  document.getElementById('news-updated').textContent =
    '更新: ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'});
}

// ===== 外部リンクを開く =====
function openSource(url) {
  if (window.electronAPI) window.electronAPI.openExternal(url);
  else window.open(url, '_blank');
}

// ===== データ取得 =====
async function loadTasks() {
  try {
    const data = await api.getTasks();
    // バックエンドが正常応答したら実データを使う（0件でもダミーにしない）
    allTasks = Array.isArray(data.tasks) ? data.tasks : DEMO_TASKS;
  } catch {
    // バックエンド未起動・通信失敗時のみダミーを表示
    allTasks = DEMO_TASKS;
  }
  updateSummary(allTasks);
  renderTasks();
}

async function loadNews() {
  // 段階1: バックエンドAPI
  try {
    const data = await api.getNews(currentNewsCategory);
    if (data.news && data.news.length > 0) { renderNews(data.news); return; }
  } catch { /* 次へ */ }
  // 段階2: メインプロセス経由RSS
  try {
    const items = await window.fetchNewsForCategory(currentNewsCategory);
    if (items && items.length > 0) { renderNews(items); return; }
  } catch { /* 次へ */ }
  // 段階3: デモデータ
  renderNews(DEMO_NEWS[currentNewsCategory] || []);
}

// ===== 優先度フィルター（フィルターバーボタン） =====
document.getElementById('priority-filters').addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  applyPriorityFilter(btn.dataset.priority);
});

// ===== 優先度フィルター適用（サマリーカードからも呼び出し） =====
function applyPriorityFilter(priority) {
  currentPriority = priority;
  document.querySelectorAll('#priority-filters .filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.priority === priority);
  });
  renderTasks();
}

// ===== サマリーカードクリックで絞り込み =====
document.querySelectorAll('.summary-card').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', () => {
    const cls = card.classList;
    const priority = cls.contains('high') ? 'high'
                   : cls.contains('medium') ? 'medium'
                   : cls.contains('low') ? 'low'
                   : cls.contains('done-card') ? 'all' : 'all';
    if (cls.contains('done-card')) {
      document.getElementById('show-done').checked = true;
      showDone = true;
    }
    applyPriorityFilter(priority);
  });
});

// ===== ソースフィルター =====
document.getElementById('source-filters').addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('#source-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentSource = btn.dataset.source;
  renderTasks();
});

// ===== 完了表示トグル =====
document.getElementById('show-done').addEventListener('change', e => {
  showDone = e.target.checked;
  renderTasks();
});

// ===== ニュースタブ =====
document.getElementById('news-tabs-container').addEventListener('click', e => {
  const tab = e.target.closest('.news-tab');
  if (!tab) return;
  document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentNewsCategory = tab.dataset.cat;
  loadNews();
});

// ===== 同期ボタン =====
document.getElementById('btn-sync').addEventListener('click', async () => {
  const iconEl = document.querySelector('#btn-sync .btn-icon');
  if (iconEl) iconEl.textContent = '⏳';
  document.getElementById('sync-status').textContent = '同期中...';
  try { await api.triggerSync(); } catch { /* noop */ }
  await Promise.all([loadTasks(), loadNews()]);
  document.getElementById('sync-status').textContent =
    '最終同期: ' + new Date().toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'});
  if (iconEl) iconEl.textContent = '🔄';
});

// ===== 設定・スクラップブックボタン =====
document.getElementById('btn-settings').addEventListener('click', () => location.href = 'settings.html');
document.getElementById('btn-scrapbook').addEventListener('click', () => location.href = 'scrapbook.html');

// ===== 初期化 =====
loadTasks();
loadNews();
