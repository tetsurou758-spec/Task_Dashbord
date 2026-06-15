// スクラップブック管理（localStorage）
const STORAGE_KEY = 'task_dashbord_scraps';

function getScraps() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveScraps(scraps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scraps));
}

function isScraped(url) {
  return getScraps().some(s => s.url === url);
}

function addScrap(article) {
  const scraps = getScraps();
  if (!scraps.some(s => s.url === article.url)) {
    scraps.unshift({ ...article, saved_at: new Date().toISOString() });
    saveScraps(scraps);
  }
}

function removeScrap(url) {
  const scraps = getScraps().filter(s => s.url !== url);
  saveScraps(scraps);
}

function toggleScrap(article) {
  if (isScraped(article.url)) { removeScrap(article.url); return false; }
  else { addScrap(article); return true; }
}

// スクラップにhtml_pathを紐付け（HTML保存完了後に呼び出す）
function updateHtmlPath(url, filepath) {
  const scraps = getScraps();
  const item = scraps.find(s => s.url === url);
  if (item) { item.html_path = filepath; saveScraps(scraps); }
}

// html_pathを取得
function getHtmlPath(url) {
  const item = getScraps().find(s => s.url === url);
  return item ? (item.html_path || null) : null;
}

// スクラップにテキスト全文を保存
function updateTextContent(url, text) {
  const scraps = getScraps();
  const item = scraps.find(s => s.url === url);
  if (item) { item.text_content = text; item.text_fetch_error = null; saveScraps(scraps); }
}

// テキスト取得失敗理由を保存
function updateTextError(url, reason) {
  const scraps = getScraps();
  const item = scraps.find(s => s.url === url);
  if (item) { item.text_fetch_error = reason; saveScraps(scraps); }
}

// 旧エラーコード 'blocked'（Google News判定）を 'gnews' に自動移行
(function migrateGnewsErrors() {
  const scraps = getScraps();
  let changed = false;
  for (const s of scraps) {
    if (s.text_fetch_error === 'blocked' && s.url && s.url.includes('news.google.com')) {
      s.text_fetch_error = 'gnews';
      changed = true;
    }
  }
  if (changed) saveScraps(scraps);
})();

window.scrapbook = { getScraps, isScraped, addScrap, removeScrap, toggleScrap, updateHtmlPath, getHtmlPath, updateTextContent, updateTextError };
