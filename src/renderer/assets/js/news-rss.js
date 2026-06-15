/**
 * フロントエンド直接RSS取得（バックエンド未起動時のフォールバック）
 * Electron環境ではCORSなしでRSSを取得できる
 * ブラウザ直接開き時はCORSエラーになるためデモデータにフォールバック
 */

const RSS_SOURCES = {
  insurance: [
    // 直接RSS（実URLが取得できるため本文スクレイピング可能）
    { url: "https://www.fsa.go.jp/news/rss.xml",                   source: "金融庁",        keywords: ["保険", "損保", "生保", "代理店", "金融"] },
    { url: "https://prtimes.jp/rss/keyword/損害保険.rss",           source: "PR TIMES",      keywords: [] },
    { url: "https://prtimes.jp/rss/keyword/保険代理店.rss",         source: "PR TIMES",      keywords: [] },
    { url: "https://www.itmedia.co.jp/news/subtop/industry/rss.xml", source: "ITmedia 産業", keywords: ["保険", "損保", "生保", "フィンテック", "InsurTech"] },
    // Google News（幅広い記事収集用・本文はブラウザ参照）
    { url: "https://news.google.com/rss/search?q=損害保険+生命保険&hl=ja&gl=JP&ceid=JP:ja", source: "Google News", keywords: [] },
    { url: "https://news.google.com/rss/search?q=損保+代理店+保険業法&hl=ja&gl=JP&ceid=JP:ja", source: "Google News", keywords: [] },
  ],
  ai: [
    { url: "https://gigazine.net/news/rss_2.0/",            source: "Gigazine",        keywords: ["AI", "人工知能", "ChatGPT", "Claude", "Gemini", "生成AI", "LLM"] },
    { url: "https://jp.techcrunch.com/feed/",               source: "TechCrunch Japan", keywords: ["AI", "人工知能", "OpenAI", "Anthropic", "Google", "Microsoft"] },
    { url: "https://www.itmedia.co.jp/news/subtop/aiplus/index.rdf", source: "ITmedia AI+", keywords: ["AI", "人工知能", "機械学習"] },
  ],
  general: [
    { url: "https://news.yahoo.co.jp/rss/topics/top-picks.xml", source: "Yahoo!ニュース",         keywords: [] },
    { url: "https://news.yahoo.co.jp/rss/topics/business.xml",  source: "Yahoo!ニュース ビジネス", keywords: [] },
  ],
  itconsult: [
    { url: "https://www.itmedia.co.jp/enterprise/subtop/features/rss.xml", source: "ITmedia エンタープライズ", keywords: ["DX", "デジタル", "クラウド", "コンサル", "システム", "SAP", "ERP", "導入", "IT"] },
    { url: "https://japan.zdnet.com/rss/index.rdf",          source: "ZDNet Japan",     keywords: ["DX", "デジタル変革", "クラウド", "コンサル", "IT戦略", "システム", "導入", "アクセンチュア", "デロイト"] },
    { url: "https://rss.itmedia.co.jp/rss/2.0/ait.xml",     source: "@IT",             keywords: ["DX", "クラウド", "システム", "開発", "導入", "IT基盤", "ERP", "SAP"] },
    { url: "https://xtech.nikkei.com/rss/index.rdf",         source: "日経クロステック", keywords: ["DX", "デジタル変革", "ITコンサル", "システム導入", "クラウド", "NTTデータ", "富士通", "アクセンチュア"] },
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
    let xmlText = '';

    // Electron環境ではメインプロセス経由で取得（CORS・User-Agent制限なし）
    if (window.electronAPI && window.electronAPI.fetchRss) {
      const result = await window.electronAPI.fetchRss(url);
      if (!result.ok) return [];
      xmlText = result.xml;
    } else {
      // ブラウザ直接開き時（デバッグ用）
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      xmlText = await res.text();
    }

    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const items = [...xml.querySelectorAll('item')];
    return items.map(item => {
      const rawUrl   = item.querySelector('link')?.textContent?.trim() || '';
      const desc     = item.querySelector('description')?.textContent || '';

      // Google News RSSはリダイレクトURL → descriptionの<a href>から実記事URLを抽出
      let articleUrl = rawUrl;
      if (rawUrl.includes('news.google.com')) {
        // DOMParserでdescriptionをHTMLとして解析（&amp;等のエンティティも正しく処理）
        try {
          const descDoc = new DOMParser().parseFromString(desc, 'text/html');
          const links = [...descDoc.querySelectorAll('a[href]')];
          const realLink = links.find(a => !a.href.includes('news.google.com') && a.href.startsWith('http'));
          if (realLink) {
            articleUrl = realLink.href;
          } else {
            console.warn('[RSS] Google News: desc内に実URLなし. rawUrl:', rawUrl, 'desc先頭:', desc.slice(0, 200));
          }
        } catch(e) {
          console.warn('[RSS] desc parse error:', e.message);
        }
      }

      return {
        title:    item.querySelector('title')?.textContent?.trim() || '',
        summary:  stripHtml(desc).slice(0, 120),
        url:      articleUrl,
        pubDate:  item.querySelector('pubDate')?.textContent || new Date().toISOString(),
      };
    });
  } catch (e) {
    console.warn('[RSS]', url, e.message);
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

  // 日時降順・重複URL除去（最大20件）
  const seen = new Set();
  return allItems
    .filter(n => { if (seen.has(n.url)) return false; seen.add(n.url); return true; })
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, 20);
}

// グローバルに公開
window.fetchNewsForCategory = fetchNewsForCategory;
