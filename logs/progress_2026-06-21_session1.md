# Task_Dashbord 進捗ログ 2026-06-21 Session1（スタンドアロン版インストーラ化）

**日付：** 2026年6月21日
**プロジェクトオーナー：** テツロウさん
**実装部隊：** Bad Company
**担当：** Claude Opus 4.8

---

## セッション概要

「git cloneだけで他端末でも動くか？」という問いを起点に、Node.js/Python不要で配布できる
**Windowsスタンドアロン版インストーラ**を作成した。
バックエンド（Python/FastAPI）をPyInstallerでexe化し、electron-builderで同梱・パッケージ化。

---

## 背景：git cloneだけでは動かない問題

調査の結果、クローンしただけでは動かないことが判明：
- `node_modules/`はgit管理外（要 npm install）
- requirements.txtが不完全（requests・pywin32が欠落）
- メール同期は win32com（Windows + Outlook 必須）
- Outlook実行パスがハードコード

→ 配布先でNode/Python不要にするため、完全スタンドアロン化を選択。

---

## 完了タスク

### ✅ 1. requirements.txt 補完（#1）
- requests、pywin32（win32_platform条件付き）、pyinstaller を追加

### ✅ 2. Outlookパス自動探索（#3）
- ハードコードを廃止し `_find_outlook_exe()` でProgram Files配下を自動探索

### ✅ 3. パス解決の共通化（exe化対応）
- `backend/paths.py` 新規作成
  - `data_dir()`: 読み取り専用同梱データ。PyInstaller時は `sys._MEIPASS`（_internal）基準
  - `db_dir()`: 書き込みデータ。exe時は `%APPDATA%\TaskDashbord\db`（Program Files直下に書けないため）
- settings.py / outlook_com.py / certifications.py を paths.py 経由に変更

### ✅ 4. バックエンドのexe化（PyInstaller）
- `backend.spec` 作成（uvicorn/fastapi/feedparser等をcollect_all、apパッケージ・COM関連をhiddenimports）
- app.py: `uvicorn.run(app, ...)`（import文字列ではなくオブジェクト渡し）でexe化対応
- `pybuild/backend/backend.exe` 生成成功
- 動作確認：100問・source=file でAPI応答（uvicorn/fastapi/データ同梱すべて成功）

### ✅ 5. Electron側のバックエンド起動切替
- main.js: `app.isPackaged` 判定で
  - 本番: 同梱した backend.exe を起動（Python不要）
  - 開発: python backend/app.py

### ✅ 6. electron-builder設定
- package.json: build:backend / build:installer / dist スクリプト追加
- extraResources で pybuild/backend → resources/backend に同梱
- nsis設定（インストール先変更可・デスクトップショートカット）
- electron を devDependencies へ移動（electron-builderの要件）

### ✅ 7. インストーラ生成成功
- 成果物：`dist\Task Dashbord Setup 0.1.0.exe`（96.9MB）
- backend.exe同梱OK、問題集6ファイル同梱OK

### ✅ 8. ドキュメント
- BUILD.md 作成（開発実行・インストーラ作成・配布範囲・注意）
- .gitignore に pybuild/・*.exe 追加（ビルド成果物は非コミット）

---

## コミット履歴（本セッション）

| コミット | 内容 |
|---|---|
| f63db94 | スタンドアロン対応（paths.py・spec・main.js・requirements・BUILD.md等） |
| 88c1eaa | PyInstaller 6系のデータ配置対応（_MEIPASS基準） |
| 8d13d8d | electronをdevDependenciesへ移動 |

---

## ハマりどころと解決

### PyInstaller 6系のデータ配置
datasは exe隣ではなく `_internal`（sys._MEIPASS）に展開される。
data_dir()を _MEIPASS 基準に修正して解決。

### electron不可（dependencies）
electron-builderは electron が dependencies にあるとエラー。devDependenciesへ移動。

### PowerShell実行ポリシー（ユーザー側）
`npm.ps1`が実行ポリシーで弾かれた。
→ `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` で解決（管理者不要）。

### winCodeSign シンボリックリンク権限（ユーザー側）
electron-builderが署名ツール展開時、mac用.dylibのシンボリックリンク作成で
「クライアントは要求された特権を保有していません」エラー。
→ **Windows開発者モードON**（一度きり）で解決。自動セッションからは付与不可だった。

---

## 配布運用メモ

- **インストーラ配布ルート**：`Task Dashbord Setup 0.1.0.exe` を渡すだけ。
  配布先は Node/Python/開発者モード いずれも不要。ダブルクリックでインストール・起動。
- **開発者モードON・実行ポリシー変更はビルドする側の一度きりの作業**で、配布先には不要。
- メール同期を使う端末のみ Outlook が必要。
- 設定・キャッシュは配布先の `%APPDATA%\TaskDashbord\db` に保存される。
- .exe等のビルド成果物はGit非管理（容量大）。配布は直接共有かGitHub Releases。

---

## 次回以降の課題

- アプリアイコン未設定（デフォルトElectronアイコン）→ icon.ico を用意して build.win.icon 指定
- コード署名（証明書）未対応 → 配布時にSmartScreen警告が出る可能性
- 自動更新（electron-updater）未対応
- メール側 Phase 4（Claude APIによる依頼抽出のAI判定）
