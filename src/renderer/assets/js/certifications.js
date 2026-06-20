// 資格対策ページ ロジック
let certList = [];
let currentCertId = null;
let currentData = null;       // 現在表示中の資格データ
let questionOrder = [];       // 表示順の問題配列（ランダム並べ替え対応）
let searchText = '';          // 検索キーワード
let allOpen = false;          // 解答の一括表示状態

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

// 配列をシャッフル（Fisher-Yates）
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 資格詳細（日程＋学習ツールバー＋問題コンテナ）の描画
function renderDetail(data) {
  const content = document.getElementById('cert-content');
  if (data.status === 'error') {
    content.innerHTML = `<div class="cert-loading">⚠️ ${esc(data.message)}</div>`;
    return;
  }

  currentData = data;
  questionOrder = (data.questions || []).slice();  // 初期は取得順
  searchText = '';
  allOpen = false;

  const scrapedHtml = (data.scraped && data.scraped.scraped_dates && data.scraped.scraped_dates.length)
    ? `<div class="cert-scraped">🔎 公式サイトから検出した日付候補: ${data.scraped.scraped_dates.map(esc).join(' / ')}</div>`
    : (data.scraped && data.scraped.scrape_error)
      ? `<div class="cert-scraped">🔎 公式サイトの自動取得に失敗（シード情報を表示中）</div>`
      : '';

  const examLabel = data.exam_date_source === 'web'
    ? '<span style="font-weight:400;font-size:0.75rem;">(公式サイトより取得)</span>'
    : '<span style="font-weight:400;font-size:0.75rem;">(目安・公式要確認)</span>';

  content.innerHTML = `
    <div class="cert-schedule">
      <div class="cert-schedule-item">
        <div class="cert-schedule-label">📅 次の試験日 ${examLabel}</div>
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

    <div class="cert-toolbar">
      <input type="text" id="cert-search" class="cert-search" placeholder="🔍 問題・解答をキーワード検索">
      <button id="cert-shuffle" class="cert-tool-btn">🔀 ランダム出題</button>
      <button id="cert-order" class="cert-tool-btn">↩ 元の順</button>
      <button id="cert-toggle-all" class="cert-tool-btn">👁 解答を一括表示</button>
    </div>

    <h2 class="cert-questions-title" id="cert-q-title"></h2>
    <div id="cert-questions"></div>
  `;

  // 公式サイトリンク
  const official = content.querySelector('.cert-official-link');
  official.addEventListener('click', () => openExternal(official.dataset.url));

  // ツールバーのイベント
  const search = document.getElementById('cert-search');
  search.addEventListener('input', () => { searchText = search.value.trim(); renderQuestions(); });
  document.getElementById('cert-shuffle').addEventListener('click', () => {
    questionOrder = shuffle(currentData.questions || []);
    renderQuestions();
  });
  document.getElementById('cert-order').addEventListener('click', () => {
    questionOrder = (currentData.questions || []).slice();
    renderQuestions();
  });
  document.getElementById('cert-toggle-all').addEventListener('click', () => {
    allOpen = !allOpen;
    renderQuestions();
  });

  renderQuestions();
}

// 外部リンクを開く
function openExternal(url) {
  if (window.electronAPI) window.electronAPI.openExternal(url);
  else window.open(url, '_blank');
}

// 問題リストの描画（検索フィルタ・並び順・一括表示を反映）
function renderQuestions() {
  const container = document.getElementById('cert-questions');
  const title = document.getElementById('cert-q-title');
  const toggleBtn = document.getElementById('cert-toggle-all');
  if (!container) return;

  // 検索フィルタ
  const kw = searchText.toLowerCase();
  const filtered = kw
    ? questionOrder.filter(q =>
        (q.q || '').toLowerCase().includes(kw) || (q.a || '').toLowerCase().includes(kw))
    : questionOrder;

  const total = (currentData.questions || []).length;
  title.textContent = kw
    ? `📝 問題（${filtered.length} / ${total}問）`
    : `📝 問題（全${total}問）`;

  if (toggleBtn) toggleBtn.textContent = allOpen ? '🙈 解答を一括非表示' : '👁 解答を一括表示';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="cert-loading">該当する問題がありません。</div>';
    return;
  }

  container.innerHTML = filtered.map((q, i) => {
    const refHtml = q.ref
      ? `<div class="cert-q-ref"><span class="cert-q-ref-link" data-url="${esc(q.ref)}">🔗 参考リンク（解説を調べる）</span></div>`
      : '';
    return `
    <div class="cert-q-item ${allOpen ? 'open' : ''}">
      <div class="cert-q-head">
        <span>Q${i + 1}. ${esc(q.q)}</span>
        <span class="cert-q-toggle">${allOpen ? '解答を隠す ▲' : '解答を表示 ▼'}</span>
      </div>
      <div class="cert-q-answer">
        <div class="cert-q-answer-label">解答</div>
        ${esc(q.a)}
        ${refHtml}
      </div>
    </div>`;
  }).join('');

  // アコーディオン開閉
  container.querySelectorAll('.cert-q-item').forEach(item => {
    const head = item.querySelector('.cert-q-head');
    head.addEventListener('click', () => {
      item.classList.toggle('open');
      const toggle = item.querySelector('.cert-q-toggle');
      toggle.textContent = item.classList.contains('open') ? '解答を隠す ▲' : '解答を表示 ▼';
    });
  });

  // 各問題の参考リンク（アコーディオン開閉に干渉させない）
  container.querySelectorAll('.cert-q-ref-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      openExternal(link.dataset.url);
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
