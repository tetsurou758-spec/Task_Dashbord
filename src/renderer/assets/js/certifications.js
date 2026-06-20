// 資格対策ページ ロジック
let certList = [];
let currentCertId = null;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// タブ描画
function renderTabs() {
  const tabs = document.getElementById('cert-tabs');
  tabs.innerHTML = certList.map(c => `
    <button class="cert-tab ${c.id === currentCertId ? 'active' : ''}" data-cert="${esc(c.id)}">
      ${esc(c.name)}
    </button>
  `).join('');
  tabs.querySelectorAll('.cert-tab').forEach(btn => {
    btn.addEventListener('click', () => selectCert(btn.dataset.cert));
  });
}

// 資格詳細描画
function renderDetail(data) {
  const content = document.getElementById('cert-content');
  if (data.status === 'error') {
    content.innerHTML = `<div class="cert-loading">⚠️ ${esc(data.message)}</div>`;
    return;
  }

  const scrapedHtml = (data.scraped && data.scraped.scraped_dates && data.scraped.scraped_dates.length)
    ? `<div class="cert-scraped">🔎 公式サイトから検出した日付候補: ${data.scraped.scraped_dates.map(esc).join(' / ')}</div>`
    : (data.scraped && data.scraped.scrape_error)
      ? `<div class="cert-scraped">🔎 公式サイトの自動取得に失敗（シード情報を表示中）</div>`
      : '';

  const questionsHtml = (data.questions || []).map((q, i) => {
    const refHtml = q.ref
      ? `<div class="cert-q-ref"><span class="cert-q-ref-link" data-url="${esc(q.ref)}">🔗 参考リンク（解説を調べる）</span></div>`
      : '';
    return `
    <div class="cert-q-item" data-qidx="${i}">
      <div class="cert-q-head">
        <span>Q${i + 1}. ${esc(q.q)}</span>
        <span class="cert-q-toggle">解答を表示 ▼</span>
      </div>
      <div class="cert-q-answer">
        <div class="cert-q-answer-label">解答</div>
        ${esc(q.a)}
        ${refHtml}
      </div>
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="cert-schedule">
      <div class="cert-schedule-item">
        <div class="cert-schedule-label">📅 次の試験日 ${data.exam_date_source === 'web' ? '<span style="font-weight:400;font-size:0.75rem;">(公式サイトより取得)</span>' : '<span style="font-weight:400;font-size:0.75rem;">(目安・公式要確認)</span>'}</div>
        <div class="cert-schedule-date">${esc(data.exam_date)}</div>
      </div>
      <div class="cert-schedule-item">
        <div class="cert-schedule-label">⏰ 申込締め切り</div>
        <div class="cert-schedule-date">${esc(data.deadline)}</div>
      </div>
      <div style="flex-basis:100%;">
        <div class="cert-note">${esc(data.note)}</div>
        <span class="cert-official-link" data-url="${esc(data.official_url)}">🔗 公式サイトを開く</span>
        ${scrapedHtml}
      </div>
    </div>

    <h2 class="cert-questions-title">📝 サンプル問題（${(data.questions || []).length}問）</h2>
    ${questionsHtml}
  `;

  // アコーディオン開閉
  content.querySelectorAll('.cert-q-item').forEach(item => {
    const head = item.querySelector('.cert-q-head');
    head.addEventListener('click', () => {
      item.classList.toggle('open');
      const toggle = item.querySelector('.cert-q-toggle');
      toggle.textContent = item.classList.contains('open') ? '解答を隠す ▲' : '解答を表示 ▼';
    });
  });

  // 公式サイトリンク・各問題の参考リンク（外部ブラウザで開く）
  content.querySelectorAll('.cert-official-link, .cert-q-ref-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();  // アコーディオン開閉に影響させない
      const url = link.dataset.url;
      if (window.electronAPI) window.electronAPI.openExternal(url);
      else window.open(url, '_blank');
    });
  });
}

// 資格選択
async function selectCert(certId) {
  currentCertId = certId;
  renderTabs();
  document.getElementById('cert-content').innerHTML = '<div class="cert-loading">読み込み中...</div>';
  try {
    const data = await api.getCertification(certId);
    renderDetail(data);
  } catch (e) {
    document.getElementById('cert-content').innerHTML =
      '<div class="cert-loading">⚠️ バックエンドに接続できません。アプリを再起動してください。</div>';
  }
}

// 更新ボタン
document.getElementById('btn-refresh').addEventListener('click', () => {
  if (currentCertId) selectCert(currentCertId);
});

// 初期化
async function init() {
  try {
    const data = await api.getCertifications();
    certList = data.certifications || [];
    if (certList.length === 0) {
      document.getElementById('cert-content').innerHTML =
        '<div class="cert-loading">資格データがありません。</div>';
      return;
    }
    currentCertId = certList[0].id;
    renderTabs();
    selectCert(currentCertId);
  } catch (e) {
    document.getElementById('cert-content').innerHTML =
      '<div class="cert-loading">⚠️ バックエンドに接続できません。アプリを再起動してください。</div>';
  }
}

init();
