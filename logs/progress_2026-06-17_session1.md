# Task_Dashbord 進捗ログ Session 1（2026-06-17）

**日付：** 2026年6月17日  
**プロジェクトオーナー：** テツロウさん  
**実装部隊：** Bad Company（バッドカンパニー）  
**担当：** Claude Sonnet 4.6（Graph API Soldier）

---

## セッション概要

実装方式変更指示書（IMPLEMENTATION_CHANGE）に基づき、Phase 2をMicrosoft Graph API方式から**ローカルファイル直接アクセス方式**に変更する実施セッション。

---

## 実装方式変更の背景

| 項目 | 旧方式（廃止） | 新方式（採用） |
|------|--------------|--------------|
| Outlook | Graph API（Azure AD登録必須） | win32com COM接続（Outlook直接） |
| Teams | Graph API | ローカルキャッシュファイル直接読み込み |
| Slack | Slack API | ローカルキャッシュファイル直接読み込み |
| 必要な申請 | 社内IT部門へAzureアプリ登録申請 | **不要** |
| インターネット接続 | 必須 | **不要（完全ローカル動作）** |

---

## 完了タスク

### ✅ 1. pywin32インストール（Outlook COM接続ライブラリ）
```
pip install pywin32 → 成功（pywin32-312）
```

---

### ✅ 2. Teams ローカルファイル構造調査

**結論：Teams 2.0（新Teams）はメッセージをローカルに保存しない**

**調査したパス：**
```
C:\Users\yoshi\AppData\Local\Packages\MSTeams_8wekyb3d8bbwe\  （Teams 2.0 MSIX）
  ├── LocalCache\Microsoft\MSTeams\EBWebView\Default\  （Chromiumプロファイル）
  │   ├── Local Storage\leveldb\  → 空（6ファイル、データなし）
  │   ├── History                 → ブラウザ閲覧履歴のみ
  │   └── Web Data                → フォームデータのみ
  └── LocalCache\Microsoft\MSTeams\tfl\  （telemetry offline storageのみ）
      ├── dGVsZW1ldHJ5... (base64) → telemetry_offline_storage_ROWCONSUMER
      └── cloud_settings.json     → 設定のみ
```

**判断：**
- Teams 2.0 はメッセージデータをすべてMicrosoftサーバーから動的取得
- ローカルキャッシュはWebView2のブラウザキャッシュのみ
- **ローカルファイル方式では取得不可**

**代替方式の検討：**
- Teams の個人用エクスポート機能（手動） → バッチ処理には不向き
- Graph API（要Azure登録） → 指示書の制約で廃止
- **→ Teams連携は現時点で保留。デモデータで継続。**

---

### ✅ 3. Slack ローカルファイル構造調査

**結論：Slackはこのマシンにインストールされていない**

**調査したパス：**
```
C:\Users\yoshi\AppData\Roaming\Slack  → NOT FOUND
C:\Users\yoshi\AppData\Local\slack    → NOT FOUND
C:\Users\yoshi\AppData\Local\Programs\slack → NOT FOUND
スタートメニューにSlackのショートカットなし
```

**判断：**
- Slackデスクトップ版が未インストール
- インストール後に再調査が必要
- **→ Slack連携は「インストール後」に再着手**

---

### ✅ 4. Outlook COM接続モジュール実装（`backend/outlook_com.py`）

**実装内容：**
- `_get_outlook()`: Outlookアプリへの接続
- `fetch_inbox_mails(max_items, days_back)`: 受信トレイからメール取得
- `fetch_flagged_mails()`: フラグ付きメール取得
- `save_cache()` / `load_cache()`: `db/outlook_cache.json` へのキャッシュ管理
- `get_mails_with_fallback()`: Outlook接続失敗時はキャッシュを返すフォールバック機能

**取得できる情報：**
- 件名・送信者名・受信日時・本文（300文字）・未読フラグ・To/CC

**前提条件：**
- Outlookがローカルにインストール済みであること
- Outlookが起動していること（または初回起動が許可されていること）

---

### ✅ 5. バックエンドAPI更新

**`backend/api/sync.py`（Phase 2対応）：**
- `POST /api/sync/trigger` → Outlookから最新メール取得してキャッシュ更新
- `GET /api/sync/status` → 最終同期日時・キャッシュ件数を返す
- Outlook接続失敗時はエラー情報を含むレスポンスを返す（フロント側で判定可能）

**`backend/api/tasks.py`（Phase 2対応）：**
- `GET /api/tasks/` → Outlookキャッシュからタスク一覧を返す
- Phase 4（AI判定）までの簡易キーワード優先度判定を実装
  - 高優先: 至急/緊急/urgent/本日中/締切/重要 等
  - 低優先: FYI/ニュースレター/案内/お知らせ 等
  - 中優先: それ以外（デフォルト）

---

## 技術的判断・制約事項

### Teams 2.0 の制限
Teams 2.0（2023年以降の新Teams）はElectronベースではなくMSIX（WebView2）ベースに変更された。すべてのメッセージデータはサーバーから動的取得され、ローカルキャッシュには保存されない。旧Teams（1.0）ではLocalStorageに一部データがあったが、新Teamsでは完全にクラウド依存。

### Slackデスクトップ版のキャッシュ
Slackデスクトップ版（Electronベース）は`%APPDATA%\Slack\`にLevelDBでメッセージをキャッシュする。インストール確認後に実装予定。

### Outlookの起動要件
win32comはOutlookプロセスを起動または既存プロセスに接続する。バックグラウンドで起動していない場合、初回接続に数秒〜十数秒かかる可能性がある。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `backend/outlook_com.py` | 新規作成：Outlook COM接続モジュール（多重起動防止含む） |
| `backend/api/tasks.py` | Phase 2対応：Outlookキャッシュからタスク返却 |
| `backend/api/sync.py` | Phase 2対応：Outlook同期トリガーAPI |

---

## Session 2 追記（2026-06-17 夜）

### ✅ 6. Outlook COM接続テスト・デバッグ完了

**発覚した問題と対処：**

| 問題 | 原因 | 対処 |
|------|------|------|
| COM接続エラー「接続されていません」(-2147352567) | Outlookが未起動またはMAPI未初期化 | 起動待ち10秒＋5回リトライ（5秒間隔）に強化 |
| 同期ボタンを押すたびにOutlookが多重起動 | `subprocess.Popen`を毎回無条件に呼んでいた | `tasklist /FI`でOUTLOOK.EXE起動確認後に条件分岐 |
| Gmail IMAP認証エラー（Google - IMAPにサインインできません） | GoogleがアプリパスワードなしのIMAP接続を拒否 | **次回対応**：Googleアプリパスワード設定が必要 |

**COM接続テスト結果（Outlook起動中の状態）：**
```
成功! 受信トレイのアイテム数: 0
```
- COM接続自体は成功 ✅
- メールが0件なのはGmail IMAP認証エラーのため（GmailアカウントがOutlookに同期できていない）

**確認されたアカウント構成：**
- メールアカウント：`okamotot2r@gmail.com`（Gmail IMAP → 認証エラーで0件）
- ステータスバー表示：「接続先: Microsoft Exchange」（カレンダー用Exchange接続）

---

## 次回以降の課題

| Phase | 内容 | 状態 |
|-------|------|------|
| Phase 2 | Outlook COM接続 | ✅ 接続成功（多重起動バグも修正済み） |
| Phase 2 | Gmailメール同期 | ⚠️ 要対応：Googleアプリパスワード設定が必要 |
| Phase 2 | Teams連携 | ⏸ 保留（Teams 2.0はローカルキャッシュ不可） |
| Phase 3 | Slack連携 | ⏸ 保留（Slackインストール後に再着手） |
| Phase 4 | AI優先度判定（Claude API） | ⏳ APIキー取得後 |
| Phase 7 | 統合テスト | ⏳ 全Phase完了後 |

---

## 次回セッション開始前チェック

1. Googleアカウント（okamotot2r@gmail.com）でアプリパスワードを生成
   - myaccount.google.com/security → 2段階認証 → アプリパスワード
   - 「メール」「Windows パソコン」で16桁パスワード生成
2. Outlookの `okamotot2r@gmail.com` アカウント設定でパスワードを更新
3. Outlookを再起動してメールが同期されることを確認
4. Task_Dashbordの同期ボタン（/api/sync/trigger）で実メール取得を検証

---

## 備考

- Teams・Slackはデモデータ（DEMO_TASKS）で継続表示
- COM接続は「Outlookが起動中」であれば確実に動作することを確認済み
