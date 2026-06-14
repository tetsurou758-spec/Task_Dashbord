// バックエンドAPIクライアント（共通）
const API_BASE = 'http://127.0.0.1:8001/api';

const api = {
  async getTasks() {
    const res = await fetch(`${API_BASE}/tasks/`);
    return res.json();
  },
  async getNews(category = 'insurance') {
    const res = await fetch(`${API_BASE}/news/?category=${category}`);
    return res.json();
  },
  async getSettings() {
    const res = await fetch(`${API_BASE}/settings/`);
    return res.json();
  },
  async saveSettings(data) {
    const res = await fetch(`${API_BASE}/settings/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async triggerSync() {
    const res = await fetch(`${API_BASE}/sync/trigger`, { method: 'POST' });
    return res.json();
  },
  async getSyncStatus() {
    const res = await fetch(`${API_BASE}/sync/status`);
    return res.json();
  },
};
