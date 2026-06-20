// 資格対策ページ ロジック
let certList = [];
let currentCertId = null;
let currentData = null;       // 現在表示中の資格データ
let questionOrder = [];       // 表示順の問題配列（ランダム並べ替え対応）
let searchText = '';          // 検索キーワード
let allOpen = false;          // 解答の一括表示状態
let quizMode = false;         // クイズモード（4択）
let weakOnly = false;         // 苦手のみ表示
let weakSet = new Set();      // 苦手としてマークした問題（問題文をキーに）

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function openExternal(url) {
  if (window.electronAPI) window.electronAPI.openExternal(url);
  else window.open(url, '_blank');
}

// ===== localStorage（苦手・正答率） =====
function loadWeak(certId) {
  try { return new Set(JSON.parse(localStorage.getItem('cert_weak_' + certId) || '[]')); }
  catch { return new Set(); }
}
function saveWeak(certId) {
  localStorage.setItem('cert_weak_' + certId, JSON.stringify([...weakSet]));
}
function loadStats(certId) {
  try { return JSON.parse(localStorage.getItem('cert_stats_' + certId) || '{"correct":0,"total":0}'); }
  catch { return { correct: 0, total: 0 }; }
}
function saveStats(certId, stats) {
  localStorage.setItem('cert_stats_' + certId, JSON.stringify(stats));
}
function recordAnswer(certId, isCorrect) {
  const s = loadStats(certId);
  s.total += 1;
  if (isCorrect) s.correct += 1;
  saveStats(certId, s);
}

// クイズセッションのスコア（今回分）
let sessionScore = { correct: 0, total: 0 };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

// 資格詳細（日程＋ツールバー＋問題コンテナ）の描画
function renderDetail(data) {
  const content = document.getElementById('cert-content');
  if (data.status === 'error') {
    content.innerHTML = `<div class="cert-loading">⚠️ ${esc(data.message)}</div>`;
    return;
  }

  currentData = data;
  questionOrder = (data.questions || []).slice();
  searchText = '';
  allOpen = false;
  quizMode = false;
  weakOnly = false;
  weakSet = loadWeak(currentCertId);
  sessionScore = { correct: 0, total: 0 };

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
      <button id="cert-shuffle" class="cert-tool-btn">🔀 ランダム</button>
      <button id="cert-order" class="cert-tool-btn">↩ 元の順</button>
      <button id="cert-toggle-all" class="cert-tool-btn">👁 解答一括</button>
      <button id="cert-weak" class="cert-tool-btn">⭐ 苦手のみ</button>
      <button id="cert-quiz" class="cert-tool-btn">📝 クイズモード</button>
    </div>

    <div id="cert-stats" class="cert-stats"></div>
    <h2 class="cert-questions-title" id="cert-q-title"></h2>
    <div id="cert-questions"></div>
  `;

  const official = content.querySelector('.cert-official-link');
  official.addEventListener('click', () => openExternal(official.dataset.url));

  const search = document.getElementById('cert-search');
  search.addEventListener('input', () => { searchText = search.value.trim(); renderQuestions(); });
  document.getElementById('cert-shuffle').addEventListener('click', () => {
    questionOrder = shuffle(currentData.questions || []); renderQuestions();
  });
  document.getElementById('cert-order').addEventListener('click', () => {
    questionOrder = (currentData.questions || []).slice(); renderQuestions();
  });
  document.getElementById('cert-toggle-all').addEventListener('click', () => {
    allOpen = !allOpen; renderQuestions();
  });
  document.getElementById('cert-weak').addEventListener('click', () => {
    weakOnly = !weakOnly; renderQuestions();
  });
  document.getElementById('cert-quiz').addEventListener('click', () => {
    quizMode = !quizMode;
    sessionScore = { correct: 0, total: 0 };
    if (quizMode) questionOrder = shuffle(currentData.questions || []);
    renderQuestions();
  });

  renderQuestions();
}

// 表示対象の問題（検索・苦手フィルタ適用後）を返す
function getFilteredQuestions() {
  let list = questionOrder;
  if (weakOnly) list = list.filter(q => weakSet.has(q.q));
  const kw = searchText.toLowerCase();
  if (kw) {
    list = list.filter(q =>
      (q.q || '').toLowerCase().includes(kw) || (q.a || '').toLowerCase().includes(kw));
  }
  return list;
}

function renderStatsBar() {
  const bar = document.getElementById('cert-stats');
  const s = loadStats(currentCertId);
  const rate = s.total ? Math.round(s.correct / s.total * 100) : 0;
  let html = `📊 累計正答率: <b>${rate}%</b>（${s.correct}/${s.total}） ・ ⭐ 苦手: <b>${weakSet.size}</b>問`;
  if (quizMode && sessionScore.total > 0) {
    const sr = Math.round(sessionScore.correct / sessionScore.total * 100);
    html += ` ・ 今回: <b>${sessionScore.correct}/${sessionScore.total}</b>（${sr}%）`;
  }
  html += ` <span class="cert-stats-reset" id="cert-stats-reset">⟳ 成績リセット</span>`;
  bar.innerHTML = html;
  const reset = document.getElementById('cert-stats-reset');
  if (reset) reset.addEventListener('click', () => {
    if (confirm('この資格の累計正答率をリセットします。よろしいですか？')) {
      saveStats(currentCertId, { correct: 0, total: 0 });
      renderStatsBar();
    }
  });
}

// 苦手マークの切替
function toggleWeak(qText) {
  if (weakSet.has(qText)) weakSet.delete(qText);
  else weakSet.add(qText);
  saveWeak(currentCertId);
  renderStatsBar();
}

// 問題リストの描画
function renderQuestions() {
  const container = document.getElementById('cert-questions');
  const title = document.getElementById('cert-q-title');
  if (!container) return;

  // ツールバーのアクティブ表示
  document.getElementById('cert-quiz').classList.toggle('active', quizMode);
  document.getElementById('cert-weak').classList.toggle('active', weakOnly);
  document.getElementById('cert-toggle-all').style.display = quizMode ? 'none' : '';

  renderStatsBar();

  const filtered = getFilteredQuestions();
  const total = (currentData.questions || []).length;
  let label = quizMode ? '📝 クイズ' : '📝 問題';
  title.textContent = (searchText || weakOnly)
    ? `${label}（${filtered.length} / ${total}問）`
    : `${label}（全${total}問）`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="cert-loading">${weakOnly ? '苦手にマークした問題はありません。' : '該当する問題がありません。'}</div>`;
    return;
  }

  if (quizMode) renderQuiz(container, filtered);
  else renderBrowse(container, filtered);
}

// 通常（閲覧）モード
function renderBrowse(container, list) {
  container.innerHTML = list.map((q, i) => {
    const isWeak = weakSet.has(q.q);
    const refHtml = q.ref
      ? `<div class="cert-q-ref"><span class="cert-q-ref-link" data-url="${esc(q.ref)}">🔗 参考リンク（解説を調べる）</span></div>`
      : '';
    return `
    <div class="cert-q-item ${allOpen ? 'open' : ''}">
      <div class="cert-q-head">
        <span class="cert-q-star ${isWeak ? 'on' : ''}" data-q="${esc(q.q)}" title="苦手にする">${isWeak ? '⭐' : '☆'}</span>
        <span class="cert-q-text">Q${i + 1}. ${esc(q.q)}</span>
        <span class="cert-q-toggle">${allOpen ? '解答を隠す ▲' : '解答を表示 ▼'}</span>
      </div>
      <div class="cert-q-answer">
        <div class="cert-q-answer-label">解答</div>
        ${esc(q.a)}
        ${refHtml}
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.cert-q-item').forEach(item => {
    const head = item.querySelector('.cert-q-head');
    head.addEventListener('click', (e) => {
      if (e.target.classList.contains('cert-q-star')) return;  // ☆クリックは開閉しない
      item.classList.toggle('open');
      const toggle = item.querySelector('.cert-q-toggle');
      toggle.textContent = item.classList.contains('open') ? '解答を隠す ▲' : '解答を表示 ▼';
    });
  });
  container.querySelectorAll('.cert-q-star').forEach(star => {
    star.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWeak(star.dataset.q);
      star.classList.toggle('on');
      star.textContent = star.classList.contains('on') ? '⭐' : '☆';
    });
  });
  container.querySelectorAll('.cert-q-ref-link').forEach(link => {
    link.addEventListener('click', (e) => { e.stopPropagation(); openExternal(link.dataset.url); });
  });
}

// クイズ（4択）モード
function renderQuiz(container, list) {
  const allAnswers = (currentData.questions || []).map(q => q.a).filter(Boolean);

  container.innerHTML = list.map((q, i) => {
    // 誤答（ダミー）を同資格の他の解答から3つ選ぶ
    const distractors = shuffle(allAnswers.filter(a => a !== q.a)).slice(0, 3);
    const choices = shuffle([q.a, ...distractors]);
    const choiceHtml = choices.map(c =>
      `<button class="cert-choice" data-correct="${c === q.a ? '1' : '0'}">${esc(c)}</button>`
    ).join('');
    const refHtml = q.ref
      ? `<span class="cert-q-ref-link" data-url="${esc(q.ref)}">🔗 参考リンク</span>` : '';
    return `
    <div class="cert-quiz-item" data-q="${esc(q.q)}">
      <div class="cert-quiz-q">Q${i + 1}. ${esc(q.q)}</div>
      <div class="cert-choices">${choiceHtml}</div>
      <div class="cert-quiz-result"></div>
      <div class="cert-quiz-answer" style="display:none;">
        <span class="cert-q-answer-label">正解</span> ${esc(q.a)} ${refHtml}
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.cert-quiz-item').forEach(item => {
    const choiceBtns = item.querySelectorAll('.cert-choice');
    let answered = false;
    choiceBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const isCorrect = btn.dataset.correct === '1';
        // 正誤の色付け
        choiceBtns.forEach(b => {
          b.disabled = true;
          if (b.dataset.correct === '1') b.classList.add('correct');
        });
        if (!isCorrect) btn.classList.add('wrong');
        // 結果表示
        const result = item.querySelector('.cert-quiz-result');
        result.textContent = isCorrect ? '⭕ 正解！' : '❌ 不正解';
        result.className = 'cert-quiz-result ' + (isCorrect ? 'ok' : 'ng');
        item.querySelector('.cert-quiz-answer').style.display = 'block';
        // スコア記録
        sessionScore.total += 1;
        if (isCorrect) sessionScore.correct += 1;
        recordAnswer(currentCertId, isCorrect);
        // 不正解は自動で苦手に追加
        if (!isCorrect) { weakSet.add(item.dataset.q); saveWeak(currentCertId); }
        renderStatsBar();
      });
    });
    const ref = item.querySelector('.cert-q-ref-link');
    if (ref) ref.addEventListener('click', () => openExternal(ref.dataset.url));
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

document.getElementById('btn-refresh').addEventListener('click', () => {
  if (currentCertId) selectCert(currentCertId);
});

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
