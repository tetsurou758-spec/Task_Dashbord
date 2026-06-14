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

  // 削除ボタン
  list.querySelectorAll('[data-remove-url]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const filepath = window.scrapbook.getHtmlPath(btn.dataset.removeUrl);
      if (filepath && window.electronAPI) window.electronAPI.deleteArticleHtml(filepath);
      window.scrapbook.removeScrap(btn.dataset.removeUrl);
      renderScraps();
    });
  });

  // 「丸ごと保存」ボタン（HTMLをローカル保存）
  list.querySelectorAll('[data-save-url]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!window.electronAPI) return;
      btn.textContent = '⏳ 保存中...';
      btn.disabled = true;
      const result = await window.electronAPI.saveArticleHtml(btn.dataset.saveUrl, btn.dataset.saveTitle);
      if (result.ok) {
        window.scrapbook.updateHtmlPath(btn.dataset.saveUrl, result.filepath);
        btn.textContent = '✅ 保存完了';
        setTimeout(() => renderScraps(), 800);
      } else {
        btn.textContent = '❌ 失敗';
        btn.disabled = false;
        setTimeout(() => { btn.textContent = '💾 丸ごと保存'; }, 2000);
      }
    });
  });

  // 保存済みHTMLを開くボタン
  list.querySelectorAll('[data-open-local]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (window.electronAPI) window.electronAPI.openLocalHtml(btn.dataset.openLocal);
    });
  });

  // 全文表示トグル
  list.querySelectorAll('.scrap-text-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = btn.dataset.idx;
      const preview = document.getElementById(`text-preview-${idx}`);
      const full    = document.getElementById(`text-full-${idx}`);
      const expanded = full.style.display !== 'none';
      preview.style.display = expanded ? '' : 'none';
      full.style.display    = expanded ? 'none' : '';
      btn.textContent = expanded ? '▼ 全文を表示' : '▲ 折りたたむ';
    });
  });

  // カード本体クリックで元記事を外部ブラウザで開く
  list.querySelectorAll('[data-open-url]').forEach(el => {
    el.addEventListener('click', () => openSource(el.dataset.openUrl));
  });
}

function scrapCardHTML(s, idx) {
  const hasHtml = !!s.html_path;
  const hasText = !!s.text_content;
  const htmlBtnAttr = hasHtml ? `data-open-local="${s.html_path}"` : '';
  const htmlBtnClass = hasHtml ? 'scrap-html-btn' : 'scrap-html-btn scrap-html-btn--none';
  const htmlBtnTitle = hasHtml ? '保存済みHTMLを開く' : 'HTML未保存（下の「丸ごと保存」で取得）';
  const htmlBtnText  = hasHtml ? '🌐 HTMLを開く' : '🌐 HTML未保存';
  const textPreview  = hasText
    ? s.text_content.slice(0, 300).replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : null;
  const textFull     = hasText
    ? s.text_content.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : null;

  return `
    <div class="scrap-card">
      <div class="scrap-card-header">
        <span class="scrap-cat-badge">${CAT_LABELS[s.category] || s.category}</span>
        <span class="scrap-saved-at">${formatSavedAt(s.saved_at)}</span>
        <div class="scrap-card-actions">
          <button class="scrap-save-html-btn" data-save-url="${s.url}" data-save-title="${(s.title||'').replace(/"/g,'')}" title="記事HTMLをまるごとローカル保存">
            ${hasHtml ? '💾 再保存' : '💾 丸ごと保存'}
          </button>
          <button class="${htmlBtnClass}" ${htmlBtnAttr} ${hasHtml ? '' : 'disabled'} title="${htmlBtnTitle}">${htmlBtnText}</button>
          <button class="scrap-remove-btn" data-remove-url="${s.url}" title="削除">★ 解除</button>
        </div>
      </div>
      <div class="scrap-card-body" data-open-url="${s.url}">
        <div class="scrap-title">${s.title}</div>
        <div class="scrap-source">${s.source} · ${formatDate(s.published_at)}</div>
      </div>
      ${hasText ? `
      <div class="scrap-text-area">
        <div class="scrap-text-preview" id="text-preview-${idx}">${textPreview}${s.text_content.length > 300 ? '...' : ''}</div>
        ${s.text_content.length > 300 ? `
        <div class="scrap-text-full" id="text-full-${idx}" style="display:none">${textFull}</div>
        <button class="scrap-text-toggle" data-idx="${idx}">▼ 全文を表示</button>
        ` : ''}
      </div>
      ` : `<div class="scrap-text-area scrap-text-none">📄 テキスト取得中 or 未取得</div>`}
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
