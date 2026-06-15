// Electron メインプロセス
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

let mainWindow;
let backendProcess;

// バックエンド（FastAPI）を起動
function startBackend() {
  backendProcess = spawn('python', [path.join(__dirname, '../../backend/app.py')], {
    cwd: path.join(__dirname, '../..'),
  });
  backendProcess.stdout.on('data', (d) => console.log('[backend]', d.toString()));
  backendProcess.stderr.on('data', (d) => console.error('[backend]', d.toString()));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Task Dashbord',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/pages/dashboard.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Node.js でURLのコンテンツを取得（CORS・User-Agent制限なし）
function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) { reject(new Error('too many redirects')); return; }
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.5',
      },
      timeout: 10000,
    }, (res) => {
      // リダイレクト対応
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        fetchUrl(nextUrl, redirectCount + 1).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // Content-Typeからエンコーディングを判定（shift_jis対応）
        const ct = (res.headers['content-type'] || '').toLowerCase();
        const enc = ct.includes('shift_jis') || ct.includes('sjis') ? 'shift_jis'
                  : ct.includes('euc-jp') ? 'euc-jp' : 'utf8';
        resolve(buf.toString(enc === 'utf8' ? 'utf8' : 'binary'));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// IPC: メインプロセス経由でRSSを取得
ipcMain.handle('fetch-rss', async (_, url) => {
  try {
    const xml = await fetchUrl(url);
    return { ok: true, xml };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// スクラップHTML保存フォルダ
function getScrapsDir() {
  const dir = path.join(app.getPath('userData'), 'scraps');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// URLをファイル名に変換（特殊文字を除去）
function urlToFilename(url) {
  const hash = Buffer.from(url).toString('base64').replace(/[/+=]/g, '_').slice(0, 80);
  return `${hash}.html`;
}

// IPC: 記事HTMLをローカルに保存
ipcMain.handle('save-article-html', async (_, { url, title }) => {
  try {
    const html = await fetchUrl(url);
    const dir = getScrapsDir();
    const filename = urlToFilename(url);
    const filepath = path.join(dir, filename);

    // <base>タグを追加して相対リンクを元URLに向ける
    const baseTag = `<base href="${url}">`;
    const enriched = html.includes('<head>')
      ? html.replace('<head>', `<head>${baseTag}`)
      : `<head>${baseTag}</head>${html}`;

    fs.writeFileSync(filepath, enriched, 'utf8');
    return { ok: true, filepath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: 保存済みHTMLをローカルブラウザで開く
ipcMain.handle('open-local-html', async (_, filepath) => {
  if (fs.existsSync(filepath)) {
    await shell.openPath(filepath);
    return { ok: true };
  }
  return { ok: false, error: 'file not found' };
});

// IPC: 保存済みHTMLファイルを削除
ipcMain.handle('delete-article-html', async (_, filepath) => {
  try {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: 保存済みHTMLが存在するか確認
ipcMain.handle('check-html-exists', async (_, filepath) => {
  return { exists: fs.existsSync(filepath) };
});

// meta-refreshリダイレクト先URLを抽出
function extractMetaRefreshUrl(html, baseUrl) {
  const m = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'\s>]+)/i)
         || html.match(/<meta[^>]+content=["'][^"']*url=([^"'\s>]+)[^"']*["'][^>]+http-equiv=["']?refresh["']?/i);
  if (!m) return null;
  const redirectUrl = m[1].replace(/['"]/g, '');
  return redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, baseUrl).href;
}

// HTMLエンティティをデコード
function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&[a-z]+;/g, '');
}

// ノイズ要素を除去（nav/header/footer/aside/script/style）
function removeNoise(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

// タグ内テキストを取得
function innerText(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

// HTMLから記事本文を抽出（段落ベース優先・フォールバック付き）
function extractText(html) {
  const cleaned = removeNoise(html);

  // Step1: <article> → <main> → コンテンツ系div を優先エリアとして絞り込む
  let scope = cleaned;
  const articleM = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainM    = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  // class/id に article|entry|post|content|body を含む div/section
  const contentM = cleaned.match(/<(?:div|section)[^>]+(?:class|id)=["'][^"']*(?:article|entry|post|content-area|article-body|article-text)[^"']*["'][^>]*>([\s\S]{200,}?)<\/(?:div|section)>/i);
  if (articleM)   scope = articleM[0];
  else if (mainM) scope = mainM[0];
  else if (contentM) scope = contentM[0];

  // Step2: <p> タグから本文段落を収集（40文字以上のものだけ）
  const paragraphs = [];
  const pReg = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pReg.exec(scope)) !== null) {
    const t = innerText(m[1]);
    if (t.length >= 40) paragraphs.push(t);
  }

  // 段落が2つ以上取れたら成功
  if (paragraphs.length >= 2) {
    return paragraphs.join('\n\n').trim();
  }

  // Step3: <h1>〜<h3> + <p> 混在でも段落が少ない場合、エリア全体をテキスト化
  const fallback = scope
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|h[1-6]|li|div|section|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(fallback)
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length >= 15)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// JSON-LD 構造化データから記事本文を抽出（JS描画サイト対策・SEO必須埋め込み）
function extractFromJsonLd(html) {
  const results = [];
  const scriptReg = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptReg.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      // 配列・単一オブジェクト両対応
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        // NewsArticle / Article / BlogPosting 等
        const body = item.articleBody || item.description || item.text || '';
        if (body && body.length >= 80) {
          results.push(body.replace(/\s+/g, ' ').trim());
        }
        // @graph 配列内にネストされている場合
        if (Array.isArray(item['@graph'])) {
          for (const g of item['@graph']) {
            const gb = g.articleBody || g.description || '';
            if (gb && gb.length >= 80) results.push(gb.replace(/\s+/g, ' ').trim());
          }
        }
      }
    } catch { /* JSON parse失敗はスキップ */ }
  }
  return results.length ? results.join('\n\n') : null;
}

// Readability.js で記事本文を抽出（Firefoxリーダービューと同アルゴリズム）
function extractWithReadability(html, url) {
  try {
    // VirtualConsole でCSSパースエラー等の警告を抑制（jsdom v20 の CSS未対応構文対策）
    const { VirtualConsole } = require('jsdom');
    const vc = new VirtualConsole();
    const dom = new JSDOM(html, { url, virtualConsole: vc });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent) return null;

    // テキストを整形（連続空行・空白を圧縮）
    const text = article.textContent
      .split('\n')
      .map(l => l.replace(/\s+/g, ' ').trim())
      .filter(l => l.length > 0)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { text, title: article.title || '' };
  } catch {
    return null;
  }
}

// IPC: 記事のテキスト全文を取得して返す（Readability優先・フォールバック付き）
ipcMain.handle('fetch-article-text', async (_, url) => {
  try {
    let html = await fetchUrl(url);

    // meta-refreshリダイレクトの追跡（最大2回）
    for (let i = 0; i < 2; i++) {
      const redirectUrl = extractMetaRefreshUrl(html, url);
      if (!redirectUrl || redirectUrl === url) break;
      url = redirectUrl;
      html = await fetchUrl(url);
    }

    // Step0: JSON-LD 構造化データから抽出（JS描画サイト・有料サイトに有効）
    const jsonLdText = extractFromJsonLd(html);
    if (jsonLdText && jsonLdText.length >= 80) {
      return { ok: true, text: jsonLdText, method: 'jsonld' };
    }

    // Step1: Readability.js で本文抽出（Firefoxリーダービューと同等）
    const readResult = extractWithReadability(html, url);
    if (readResult && readResult.text.length >= 80) {
      return { ok: true, text: readResult.text, method: 'readability' };
    }

    // Step2: 段落ベースのヒューリスティック抽出にフォールバック
    const text = extractText(html);
    if (text.length >= 60) {
      return { ok: true, text, method: 'heuristic' };
    }

    // エラー種別を分類
    const reason = /ログイン|会員|login|subscribe|paywall/i.test(text + (jsonLdText || '')) ? 'paywall'
                 : text.length === 0 ? 'empty' : 'short';
    return { ok: false, reason, error: `本文取得不可（${text.length}文字）` };
  } catch (err) {
    const reason = /400|403|blocked/i.test(err.message) ? 'blocked'
                 : /timeout/i.test(err.message) ? 'timeout' : 'error';
    return { ok: false, reason, error: err.message };
  }
});

// IPC: 元ソース（Outlook/Teams/Slack）を外部ブラウザで開く
ipcMain.on('open-external', (_, url) => shell.openExternal(url));

app.whenReady().then(() => {
  startBackend();
  setTimeout(createWindow, 2000);
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
