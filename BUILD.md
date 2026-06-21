# Task Dashbord ビルド・配布手順

## 開発実行（ソースから動かす）

前提：Node.js と Python 3.12 がインストール済み。

```powershell
npm install
pip install -r requirements.txt
npm start
```

`npm start` で Electron が起動し、バックエンド（python backend/app.py）も自動起動します。

---

## スタンドアロン版インストーラの作成（Windows）

配布先の端末に **Node.js も Python も不要**な `.exe` インストーラを作ります。

### 必要なもの（ビルドする側のみ）
- Node.js
- Python 3.12 + `pip install -r requirements.txt`（pyinstaller含む）

### 手順
```powershell
npm install
pip install -r requirements.txt
npm run dist
```

`npm run dist` は次を順に実行します。
1. `build:backend` … PyInstallerで `backend/app.py` を `pybuild/backend/backend.exe` に固める（Python同梱）
2. `build:installer` … electron-builderでフロントを固め、上記backendを同梱したインストーラを生成

### 成果物
`dist/Task Dashbord Setup x.y.z.exe` がインストーラ本体です。
これを配布先端末で実行すればインストールでき、Node/Python無しで起動します。

---

## 配布先端末での動作範囲

| 機能 | Windows | Mac/Linux |
|---|---|---|
| 資格対策・ニュース・スクラップブック | ✅ | ✅（要ソース実行） |
| メール同期（Outlook連携） | ✅（Outlook必須） | ❌（win32com非対応） |

- インストーラ（.exe）はWindows専用です。
- メール同期は配布先にOutlookがインストール・サインイン済みである必要があります。
- 設定・キャッシュは `%APPDATA%\TaskDashbord\db` に保存されます。

---

## 注意
- `.exe` などビルド成果物は容量が大きいため Git には含めません（`.gitignore`で除外）。
- 配布はインストーラを直接共有するか、GitHub Releases等を利用してください。
