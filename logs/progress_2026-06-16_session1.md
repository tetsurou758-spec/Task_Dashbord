# Task_Dashbord 進捗ログ Session 1（2026-06-16）

**日付：** 2026年6月16日  
**プロジェクトオーナー：** テツロウさん  
**実装部隊：** Bad Company（バッドカンパニー）  
**担当：** Claude Sonnet 4.6

---

## セッション概要

スクラップブックの本文取得エラー調査・改修セッション。
Google Newsの構造的制限を特定し、ハイブリッド方式で解決した。

---

## 完了タスク

### ✅ 1. JSON-LD構造化データ抽出をStep0として追加（feat）
**コミット：** `5f5001a`

- `extractFromJsonLd()` を追加：`<script type=application/ld+json>` から articleBody/description/text を抽出
- `@graph` 配列内のネスト構造にも対応
- 処理順を Step0(JSON-LD) → Step1(Readability) → Step2(heuristic) に変更
- `extractWithReadability()` に VirtualConsole を追加し jsdom v20 の CSS パースエラー警告を抑制
- `dashboard.js` でmethod表示ラベルに jsonld を追加

---

### ✅ 2. Google News URL取得の調査・デバッグ
**コミット：** `08843de`（診断ログ追加） → `d0a5988`（DOMParser修正）

**判明した事実：**
- Google News RSS の `<link>` = `news.google.com/rss/articles/CBMi...`（リダイレクトURL）
- `<description>` 内の `<a href>` も `news.google.com` に戻るURL（実記事URLではない）
- DOMParser での description 解析に変更しても解決しなかった
- `CBMi...` の base64 デコードを試みたが、URLはAES暗号化されており平文で取得不可

**技術的結論：**
Google News はURL を AES-CBC 暗号化しており、ブラウザの JavaScript なしには実URLに到達できない（構造的制限）。

---

### ✅ 3. Google News専用エラー区分 `gnews` を追加（fix）
**コミット：** `c0fe066`

- `main.js`: decode失敗時に `reason: 'gnews'` を返す
- `scrapbook-page.js`: `gnews` 専用エラーメッセージを追加
- `scrapbook.js`: 旧 `blocked` エラーを `news.google.com` URL に限り `gnews` へ自動移行

---

### ✅ 4. ニュース取得ハイブリッド方式を実装（feat）
**コミット：** `1b8f69a`

**指示書：** `NEWS_HYBRID_IMPLEMENTATION.md`（テツロウさん作成）

**実装内容：**

#### dashboard.js（取得ロジック分岐）
- gnews URL（`news.google.com` 含む）→ 本文取得スキップ、即 `gnews` エラー記録
- 直接RSS URL → 従来通り本文スクレイピング（失敗時は description フォールバック）

#### scrapbook-page.js（UI改善）
- `gnews` 専用表示ブロックを追加
  - 青系・情報調（赤エラーではなく仕様案内）
  - RSSリード文を青ボーダーカードで表示
  - 「🌐 ブラウザで全文を読む」ボタンを追加
- `acc-gnews-browser-btn` クリックイベントをバインド

#### news-rss.js（RSSソース拡充）
保険カテゴリに直接RSSを追加（上位に配置）：
- 金融庁 `https://www.fsa.go.jp/news/rss.xml`（既存）
- PR TIMES 損害保険キーワード RSS
- PR TIMES 保険代理店キーワード RSS
- ITmedia 産業ニュース RSS（保険・InsurTechキーワードフィルター）
- Google News（幅広い収集用として後方に維持）

#### main.css（スタイル追加）
- `.acc-text-gnews`：青系背景・左ボーダー（情報的）
- `.acc-gnews-browser-btn`：青ボタン

#### main.js（クリーンアップ）
- デバッグ用 `console.log` を削除

---

## ハイブリッド方式の最終形

| ニュースソース | 本文取得 | スクラップ表示 |
|---|---|---|
| 金融庁・PR TIMES・ITmedia等（直接RSS） | ✅ Readability/JSON-LD | 本文全文 |
| Gigazine・TechCrunch Japan等（直接RSS） | ✅ Readability | 本文全文 |
| Google News経由 | ❌ URL暗号化で不可 | 📰 リード文＋ブラウザリンク |
| 東洋経済・日経等（有料） | ❌ ペイウォール | 🔒 会員限定メッセージ |

---

## 技術的判断事項

### Google News URLの構造的制限（2024年頃から）
- `CBMi...` の base64 はプロトバフ構造で AES-CBC 暗号化されている
- ブラウザの JS 実行なしに実URLへの到達は不可能
- Playwright 等のヘッドレスブラウザを使えば解決可能だが重量級すぎるため採用しない
- **方針：** Google News は幅広い記事発見用として活用、リード文で概要把握、詳細はブラウザへ

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/main/main.js` | JSON-LD抽出・Googleデコード・ログクリーンアップ |
| `src/renderer/assets/js/dashboard.js` | gnews分岐・methodラベル |
| `src/renderer/assets/js/scrapbook-page.js` | gnews情報表示・ブラウザリンク |
| `src/renderer/assets/js/scrapbook.js` | blockedからgnewsへの自動移行 |
| `src/renderer/assets/js/news-rss.js` | 直接RSSソース追加・DOMParser修正 |
| `src/renderer/assets/css/main.css` | gnewsスタイル追加 |

---

## 次回以降の課題（未着手）

| Phase | 内容 | 必要な準備 |
|-------|------|-----------|
| Phase 2 | Microsoft Graph API連携（Outlook/Teams） | Azure Client ID / Secret / Tenant ID |
| Phase 3 | Slack API連携 | Slack Bot Token / Team ID |
| Phase 4 | AI優先度判定（Claude API） | Anthropic API Key |
| Phase 7 | 統合テスト | 全Phase完了後 |
