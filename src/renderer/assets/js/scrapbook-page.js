// スクラップブック画面ロジック
let currentCat = 'all';

const CAT_LABELS = {
  all:       '📋 すべて',
  insurance: '🏢 保険',
  ai:        '🤖 AI',
  itconsult: '💼 ITコンサル',
  general:   '📰 一般',
};

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
}

function formatSavedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `保存: ${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function openSource(url) {
  if (window.electronAPI) window.electronAPI.openExternal(url);
  else window.open(url, '_blank');
}

function renderScraps() {
  const all = window.scrapbook.getScraps();
  const filtered = currentCat === 'all' ? all : all.filter(s => s.category === currentCat);

  // 日付降順（saved_at）
  filtered.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));

  const countEl = document.getElementById('scrap-count');
  countEl.textContent = `${filtered.length} 件保存済み`;

  const list = document.getElementById('scrap-list');
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-message">
        <span class="empty-icon">📌</span>
        ニュース記事の ☆ をクリックすると<br>ここに保存されます
      </div>`;
    return;
  }

  // カテゴリごとにグループ化（「すべて」タブのとき）
  if (currentCat === 'all') {
    const groups = {};
    filtered.forEach(s => {
      const cat = s.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });

    list.innerHTML = Object.entries(groups).map(([cat, items]) => `
      <div class="scrap-group">
        <div class="scrap-group-header">${CAT_LABELS[cat] || cat}</div>
        ${items.map(s => scrapCardHTML(s)).join('')}
      </div>
    `).join('');
  } else {
    list.innerHTML = filtered.map(s => scrapCardHTML(s)).join('');
  }

  // 削除ボタンのイベント
  list.querySelectorAll('[data-remove-url]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      window.scrapbook.removeScrap(btn.dataset.removeUrl);
      renderScraps();
    });
  });

  // カード本体クリックで元記事を開く
  list.querySelectorAll('[data-open-url]').forEach(el => {
    el.addEventListener('click', () => openSource(el.dataset.openUrl));
  });
}

function scrapCardHTML(s) {
  const safeUrl = encodeURIComponent(s.url);
  return `
    <div class="scrap-card">
      <div class="scrap-card-header">
        <span class="scrap-cat-badge">${CAT_LABELS[s.category] || s.category}</span>
        <span class="scrap-saved-at">${formatSavedAt(s.saved_at)}</span>
        <button class="scrap-remove-btn" data-remove-url="${s.url}" title="削除">★ 解除</button>
      </div>
      <div class="scrap-card-body" data-open-url="${s.url}">
        <div class="scrap-title">${s.title}</div>
        <div class="scrap-summary">${s.summary || ''}</div>
        <div class="scrap-source">${s.source} · ${formatDate(s.published_at)}</div>
      </div>
    </div>
  `;
}

// タブ切り替え
document.getElementById('scrap-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.scrap-tab');
  if (!tab) return;
  document.querySelectorAll('.scrap-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentCat = tab.dataset.cat;
  renderScraps();
});

// すべて削除
document.getElementById('btn-clear-all').addEventListener('click', () => {
  const all = window.scrapbook.getScraps();
  const filtered = currentCat === 'all' ? all : all.filter(s => s.category === currentCat);
  if (filtered.length === 0) return;
  const label = currentCat === 'all' ? 'すべて' : CAT_LABELS[currentCat];
  if (!confirm(`「${label}」の ${filtered.length} 件を削除しますか？`)) return;
  if (currentCat === 'all') {
    localStorage.removeItem('task_dashbord_scraps');
  } else {
    const remaining = all.filter(s => s.category !== currentCat);
    localStorage.setItem('task_dashbord_scraps', JSON.stringify(remaining));
  }
  renderScraps();
});

// 初期描画
renderScraps();
