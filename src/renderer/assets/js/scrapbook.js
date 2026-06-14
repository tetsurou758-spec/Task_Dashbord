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

window.scrapbook = { getScraps, isScraped, addScrap, removeScrap, toggleScrap };
