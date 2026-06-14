/**
 * フロントエンド直接RSS取得（バックエンド未起動時のフォールバック）
 * Electron環境ではCORSなしでRSSを取得できる
 * ブラウザ直接開き時はCORSエラーになるためデモデータにフォールバック
 */

const RSS_SOURCES = {
  insurance: [
    { url: "https://www.fsa.go.jp/news/rss.xml",            source: "金融庁",           keywords: ["保険", "金融", "損保", "代理店", "リスク"] },
    { url: "https://rss.nikkei.com/rss/nkd/news.rdf",       source: "日本経済新聞",     keywords: ["保険", "損保", "生保", "共済"] },
    { url: "https://www.tokio-marine.com/rss/news.xml",     source: "東京海上",         keywords: ["保険"] },
  ],
  ai: [
    { url: "https://gigazine.net/news/rss_2.0/",            source: "Gigazine",        keywords: ["AI", "人工知能", "ChatGPT", "Claude", "Gemini", "生成AI", "LLM"] },
    { url: "https://jp.techcrunch.com/feed/",               source: "TechCrunch Japan", keywords: ["AI", "人工知能", "OpenAI", "Anthropic", "Google", "Microsoft"] },
    { url: "https://www.itmedia.co.jp/news/subtop/aiplus/index.rdf", source: "ITmedia AI+", keywords: ["AI", "人工知能", "機械学習"] },
  ],
  general: [
    { url: "https://www3.nhk.or.jp/rss/news/cat0.xml",      source: "NHK",             keywords: [] },
    { url: "https://rss.asahi.com/rss/asahi/newsheadlines.rdf", source: "朝日新聞",    keywords: [] },
  ],
  itconsult: [
    { url: "https://www.itmedia.co.jp/enterprise/subtop/features/rss.xml", source: "ITmedia エンタープライズ", keywords: ["DX", "デジタル", "クラウド", "コンサル", "システム", "IT", "SAP", "ERP", "導入"] },
    { url: "https://japan.zdnet.com/rss/index.rdf",          source: "ZDNet Japan",     keywords: ["DX", "デジタル変革", "クラウド", "コンサル", "IT戦略", "システム", "導入", "アクセンチュア", "デロイト", "マッキンゼー"] },
    { url: "https://www.cio.com/feed/",                      source: "CIO",             keywords: ["consulting", "digital", "transformation", "cloud", "ERP", "strategy"] },
    { url: "https://rss.nikkei.com/rss/nkd/news.rdf",       source: "日本経済新聞",    keywords: ["DX", "デジタル変革", "ITコンサル", "システム導入", "アクセンチュア", "デロイト", "フジitec", "NTTデータ", "富士通"] },
  ],
};

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

function makeId(str) {
  let h = 0;
  for (let c of str) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h).toString(16);
}

async function fetchRssDirect(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');
    const items = [...xml.querySelectorAll('item')];
    return items.map(item => ({
      title:    item.querySelector('title')?.textContent?.trim() || '',
      summary:  stripHtml(item.querySelector('description')?.textContent || '').slice(0, 120),
      url:      item.querySelector('link')?.textContent?.trim() || '',
      pubDate:  item.querySelector('pubDate')?.textContent || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

async function fetchNewsForCategory(category) {
  const sources = RSS_SOURCES[category] || [];
  const allItems = [];

  await Promise.allSettled(sources.map(async (src) => {
    const entries = await fetchRssDirect(src.url);
    for (const e of entries) {
      if (!e.title || !e.url) continue;
      // キーワードフィルター（空配列は全件通過）
      if (src.keywords.length > 0) {
        const text = (e.title + e.summary).toLowerCase();
        const hit = src.keywords.some(kw => text.includes(kw.toLowerCase()));
        if (!hit) continue;
      }
      allItems.push({
        id:           makeId(e.url),
        category,
        title:        e.title,
        summary:      e.summary || '',
        url:          e.url,
        source:       src.source,
        published_at: new Date(e.pubDate).toISOString(),
      });
    }
  }));

  // 日時降順・重複URL除去
  const seen = new Set();
  return allItems
    .filter(n => { if (seen.has(n.url)) return false; seen.add(n.url); return true; })
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 12);
}

// グローバルに公開
window.fetchNewsForCategory = fetchNewsForCategory;
