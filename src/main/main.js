// Electron メインプロセス
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

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

// IPC: 記事のテキスト全文を取得して返す（meta-refreshリダイレクト対応）
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

    const text = extractText(html);

    if (text.length < 60) {
      return { ok: false, error: `コンテンツ取得不可（${text.length}文字）: ログイン必須またはJS描画ページの可能性` };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: Claude APIで抽出テキストを記事本文のみにクリーンアップ
ipcMain.handle('llm-clean-text', async (_, { rawText, apiKey }) => {
  if (!apiKey) return { ok: false, error: 'API Keyが未設定です（設定画面で入力してください）' };
  try {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `以下はWebページから抽出したテキストです。ナビゲーションメニュー・広告・サイドバー・フッター・関連記事リンク・著作権表記などのノイズを除去し、記事の本文（見出しと本文段落）のみを抽出してください。\n箇条書きや見出しは保持し、本文の内容は一切変更しないでください。\n\n---\n${rawText.slice(0, 8000)}\n---`,
      }],
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 30000,
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.content && json.content[0]) resolve(json.content[0].text);
            else reject(new Error(json.error?.message || 'APIエラー'));
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(body);
      req.end();
    });

    return { ok: true, text: result };
  } catch (err) {
    return { ok: false, error: err.message };
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
