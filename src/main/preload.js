// レンダラープロセスに安全なAPIを公開
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 元ソース（メール/チャット）を外部アプリで開く
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
