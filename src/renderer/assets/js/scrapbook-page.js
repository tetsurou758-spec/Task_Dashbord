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

// テキストを安全にHTMLエスケープ
function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== カードHTML生成 =====
function scrapCardHTML(s, idx) {
  const hasHtml = !!s.html_path;
  const hasText = !!(s.text_content && s.text_content.trim().length > 0);

  // アコーディオン本文エリア
  let bodyContent;
  if (hasText) {
    const lines   = s.text_content.split('\n').filter(l => l.trim());
    const preview = lines.slice(0, 8).map(esc).join('\n');   // 最初の8行
    const full    = lines.map(esc).join('\n');
    const hasMore = lines.length > 8;
    bodyContent = `
      <div class="acc-text-preview" id="acc-preview-${idx}">${preview}${hasMore ? '\n…' : ''}</div>
      ${hasMore ? `<div class="acc-text-full" id="acc-full-${idx}" hidden>${full}</div>` : ''}
      <div class="acc-text-footer">
        ${hasMore ? `<button class="acc-toggle-btn" data-idx="${idx}">▼ 全文を表示（${lines.length}行）</button>` : ''}
        <span class="acc-text-len">${s.text_content.length.toLocaleString()} 文字</span>
      </div>`;
  } else {
    bodyContent = `<div class="acc-text-empty">📄 テキスト未取得（☆を外して再度クリックで再試行）</div>`;
  }

  return `
    <div class="scrap-card" id="scrap-card-${idx}">

      <!-- ヘッダー行 -->
      <div class="scrap-card-header">
        <span class="scrap-cat-badge">${CAT_LABELS[s.category] || s.category}</span>
        <span class="scrap-saved-at">${formatSavedAt(s.saved_at)}</span>
        <div class="scrap-card-actions">
          <button class="scrap-save-html-btn"
            data-save-url="${esc(s.url)}"
            data-save-title="${esc(s.title)}"
            title="ページHTMLをまるごとローカル保存">
            ${hasHtml ? '💾 再保存' : '💾 丸ごと保存'}
          </button>
          ${hasHtml
            ? `<button class="scrap-html-btn" data-open-local="${esc(s.html_path)}" title="保存済みHTMLを開く">🌐 HTMLを開く</button>`
            : `<button class="scrap-html-btn scrap-html-btn--none" disabled title="HTML未保存">🌐 HTML未保存</button>`}
          <button class="scrap-remove-btn" data-remove-url="${esc(s.url)}" title="スクラップ解除">★ 解除</button>
        </div>
      </div>

      <!-- タイトル（クリックで元記事を開く） -->
      <div class="scrap-card-title" data-open-url="${esc(s.url)}" title="元記事を開く">
        ${esc(s.title)}
      </div>
      <div class="scrap-card-meta">${esc(s.source)} · ${formatDate(s.published_at)}</div>

      <!-- アコーディオントリガー -->
      <button class="acc-trigger" data-acc="${idx}" aria-expanded="false">
        ▶ 本文を見る
        ${hasText ? '' : ' <span class="acc-trigger-warn">（未取得）</span>'}
      </button>

      <!-- アコーディオン本文（デフォルト非表示） -->
      <div class="acc-body" id="acc-body-${idx}" hidden>
        ${bodyContent}
      </div>

    </div>
  `;
}

// ===== 描画メイン =====
function renderScraps() {
  const all = window.scrapbook.getScraps();
  const filtered = currentCat === 'all' ? all : all.filter(s => s.category === currentCat);
  filtered.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));

  document.getElementById('scrap-count').textContent = `${filtered.length} 件保存済み`;

  const list = document.getElementById('scrap-list');
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-message">
        <span class="empty-icon">📌</span>
        ニュース記事の ☆ をクリックすると<br>ここに保存されます
      </div>`;
    return;
  }

  let globalIdx = 0;
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
        ${items.map(s => scrapCardHTML(s, globalIdx++)).join('')}
      </div>
    `).join('');
  } else {
    list.innerHTML = filtered.map(s => scrapCardHTML(s, globalIdx++)).join('');
  }

  bindEvents(list);
}

// ===== イベントバインド =====
function bindEvents(list) {
  // ★ 解除
  list.querySelectorAll('[data-remove-url]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const filepath = window.scrapbook.getHtmlPath(btn.dataset.removeUrl);
      if (filepath && window.electronAPI) window.electronAPI.deleteArticleHtml(filepath);
      window.scrapbook.removeScrap(btn.dataset.removeUrl);
      renderScraps();
    });
  });

  // 💾 丸ごと保存
  list.querySelectorAll('[data-save-url]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!window.electronAPI) return;
      btn.textContent = '⏳ 保存中...';
      btn.disabled = true;
      const result = await window.electronAPI.saveArticleHtml(btn.dataset.saveUrl, btn.dataset.saveTitle);
      if (result.ok) {
        window.scrapbook.updateHtmlPath(btn.dataset.saveUrl, result.filepath);
        btn.textContent = '✅ 完了';
        setTimeout(() => renderScraps(), 700);
      } else {
        btn.textContent = '❌ 失敗';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = '💾 丸ごと保存'; }, 2500);
      }
    });
  });

  // 🌐 HTMLを開く
  list.querySelectorAll('[data-open-local]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (window.electronAPI) window.electronAPI.openLocalHtml(btn.dataset.openLocal);
    });
  });

  // タイトルクリックで元記事を開く
  list.querySelectorAll('[data-open-url]').forEach(el => {
    el.addEventListener('click', () => openSource(el.dataset.openUrl));
  });

  // アコーディオントリガー
  list.querySelectorAll('.acc-trigger').forEach(trigger => {
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const idx  = trigger.dataset.acc;
      const body = document.getElementById(`acc-body-${idx}`);
      const open = !body.hidden;
      body.hidden = open;
      trigger.setAttribute('aria-expanded', !open);
      trigger.textContent = open
        ? '▶ 本文を見る'
        : '▼ 本文を閉じる';
      // 未取得ラベルを再付与
      const item = window.scrapbook.getScraps().find((_, i) => String(i) === idx);
    });
  });

  // 全文展開トグル
  list.querySelectorAll('.acc-toggle-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx     = btn.dataset.idx;
      const preview = document.getElementById(`acc-preview-${idx}`);
      const full    = document.getElementById(`acc-full-${idx}`);
      const expanded = !full.hidden;
      full.hidden    = expanded;
      preview.hidden = !expanded;
      btn.textContent = expanded
        ? `▼ 全文を表示（${full ? full.textContent.split('\n').length : ''}行）`
        : '▲ 折りたたむ';
    });
  });
}

// ===== タブ切り替え =====
document.getElementById('scrap-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.scrap-tab');
  if (!tab) return;
  document.querySelectorAll('.scrap-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentCat = tab.dataset.cat;
  renderScraps();
});

// ===== すべて削除 =====
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
