// レンダラープロセスに安全なAPIを公開
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 元ソース（メール/チャット）を外部アプリで開く
  openExternal: (url) => ipcRenderer.send('open-external', url),
  // メインプロセス経由でRSSを取得（CORS・User-Agent制限なし）
  fetchRss: (url) => ipcRenderer.invoke('fetch-rss', url),
  // 記事HTMLをローカルファイルに保存
  saveArticleHtml: (url, title) => ipcRenderer.invoke('save-article-html', { url, title }),
  // 保存済みHTMLをブラウザで開く
  openLocalHtml: (filepath) => ipcRenderer.invoke('open-local-html', filepath),
  // 保存済みHTMLを削除
  deleteArticleHtml: (filepath) => ipcRenderer.invoke('delete-article-html', filepath),
  // 保存済みHTMLが存在するか確認
  checkHtmlExists: (filepath) => ipcRenderer.invoke('check-html-exists', filepath),
});
