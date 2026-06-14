# Task_Dashbord 進捗ログ Session 2

**日付：** 2026年6月15日（セッション2）  
**プロジェクトオーナー：** テツロウさん  
**実装部隊：** Bad Company（バッドカンパニー）  
**担当：** Claude Sonnet 4.6

---

## セッション概要

スクラップブック機能の本格実装・品質改善セッション。
記事本文の自動保存・アコーディオンUI・フィルターバグ修正・テキスト抽出の高精度化を実施。

---

## 完了タスク

### ✅ 1. スクラップ時にHTMLをローカル自動保存（feat）
**コミット：** `3cac132`

- `main.js` に `save-article-html` / `open-local-html` / `delete-article-html` IPCハンドラーを追加
- 記事スクラップ（☆クリック）時に元ページHTMLをまるごとローカルファイルに保存
- 保存先：`%APPDATA%\Task Dashbord\scraps\`
- `<base href="元URL">` タグを自動挿入して相対リンクが機能する状態で保存
- スクラップブック画面に「💾 丸ごと保存」「🌐 HTMLを開く」ボタンを追加
- ★解除時にローカルHTMLファイルも自動削除

**変更ファイル：**
- `src/main/main.js`
- `src/main/preload.js`
- `src/renderer/assets/js/scrapbook.js`
- `src/renderer/assets/js/scrapbook-page.js`
- `src/renderer/assets/js/dashboard.js`
- `src/renderer/assets/css/main.css`

---

### ✅ 2. スクラップ記事テキスト全文保存・HTML丸ごと保存ボタン・優先度フィルター修正（feat/fix）
**コミット：** `06612b0`

**テキスト全文保存（必須機能）：**
- ☆クリック時にテキスト全文を自動取得してlocalStorageに保存
- `scrapbook.js` に `updateTextContent()` を追加

**優先度フィルターバグ修正：**
- 原因：上部サマリーカード（高優先0件・中優先0件...）にクリックイベントがなかった
- 修正：`applyPriorityFilter()` 共通関数を作成し、サマリーカードクリックで絞り込み対応
- サマリーカードにホバーエフェクトを追加しクリック可能と明示

**UIスクラップ機能選択：**
- スクラップ画面に「💾 丸ごと保存」（HTMLローカル保存・任意）ボタン追加

**変更ファイル：**
- `src/main/main.js`
- `src/main/preload.js`
- `src/renderer/assets/js/scrapbook.js`
- `src/renderer/assets/js/scrapbook-page.js`
- `src/renderer/assets/js/dashboard.js`
- `src/renderer/assets/css/main.css`

---

### ✅ 3. スクラップブック画面に垂直スクロールバー追加（feat）
**コミット：** `f3562ec`

- `.scrapbook-layout` を flex + `height: calc(100vh - header)` に変更
- `.scrap-list` に `overflow-y: auto` でスクロール有効化
- スクロールバーをスリム（6px）・半透明スタイルに設定（Webkit + Firefox両対応）
- ヘッダー・タブは固定、記事一覧エリアのみスクロール

**変更ファイル：**
- `src/renderer/assets/css/main.css`

---

### ✅ 4. スクラップブックのテキスト取得失敗・スペース問題修正・アコーディオン化（fix）
**コミット：** `d1617d2`

**原因調査：**
- テキストエリアに余計なナビゲーション・メニューが混入 → 空白行が大量発生してスペースが爆発
- Google NewsのリダイレクトページしかHTMLが取れておらず「Google ニュース」11文字のみ保存

**修正内容：**
- `extractText()` を `<article>` → `<main>` → コンテンツdiv の優先抽出に改善
- nav/header/footer/aside を事前除去
- 行ごとに trim → 空行除去 → join の方式で空白行を防止
- `meta http-equiv="refresh"` リダイレクトの追跡追加
- テキスト80文字未満は取得失敗扱いにして誤データを保存しない

**UIアコーディオン化：**
- カードを折りたたみ式に変更（デフォルトは折りたたみ）
- 「▶ 本文を見る」クリックで展開（max-height: 320px + 内部スクロール）
- 本文内「▼ 全文を表示」で展開可能（行数表示あり）

**変更ファイル：**
- `src/main/main.js`
- `src/renderer/assets/js/scrapbook-page.js`
- `src/renderer/assets/css/main.css`

---

### ✅ 5. Google NewsのURL問題修正・テキスト抽出改善（fix）
**コミット：** `bb35b64`

**Google News URL修正：**
- RSS `<link>` は `news.google.com/rss/articles/CBMi...` リダイレクトURL
- `<description>` 内の `<a href="実記事URL">` から実際の記事URLを取得するよう変更

**テキスト抽出の段落ベース化：**
- `<p>` タグ（40文字以上）を優先抽出
- `decodeEntities()` / `removeNoise()` / `innerText()` を分離関数化

**変更ファイル：**
- `src/main/main.js`
- `src/main/preload.js`
- `src/renderer/assets/js/news-rss.js`
- `src/renderer/assets/js/dashboard.js`
- `src/renderer/assets/js/settings.js`
- `src/renderer/pages/settings.html`
- `src/renderer/assets/css/main.css`

---

### ✅ 6. テキスト抽出をMozilla Readability.jsに切り替え（feat）
**コミット：** `62e85b6`

**背景：**
- ユーザーからAPIキー課金なしの代替手段を要望
- Mozilla Readability.js（Firefoxリーダービューと同アルゴリズム）を採用

**実装：**
- `npm install @mozilla/readability jsdom@20`
- `main.js` に `extractWithReadability()` を追加
- Readability失敗時は段落ベースヒューリスティックにフォールバック
- LLMクリーンアップ機能・APIキー設定欄を削除（コスト不要方針）

**処理フロー：**
```
☆クリック → URL取得
  ↓
Readability.js（Firefoxリーダービュー相当）← 精度高・無償
  ↓ 失敗時（80文字未満）
段落ベースヒューリスティック（<p>タグ優先）
  ↓ 失敗時（60文字未満）
「本文取得不可」として記録
```

**変更ファイル：**
- `src/main/main.js`
- `src/main/preload.js`
- `src/renderer/assets/js/dashboard.js`
- `src/renderer/pages/settings.html`
- `package.json` / `package-lock.json`

---

### ✅ 7. jsdom v20 固定（ERR_REQUIRE_ESM エラー解消）（fix）
**コミット：** `a13c0a3`

**原因：**
- jsdom 21+ が ESM-only の `@exodus/bytes` に依存
- Electron メインプロセスは CommonJS `require()` → `ERR_REQUIRE_ESM` クラッシュ

**修正：**
- `npm install jsdom@20` で CommonJS 互換版に固定

**変更ファイル：**
- `package.json` / `package-lock.json`

---

### ✅ 8. テキスト取得失敗の原因表示・RSSリード文フォールバック（fix）
**コミット：** `9325ef5`

**原因調査：**
- Google News RSS記事URL (`news.google.com/rss/articles/CBMi...`) は
  Node.js から HTTP GET すると **HTTP 400 Bad Request** が返る
  → Googleがサーバーサイドフェッチをブロックしているため構造的に取得不可
- 東洋経済・日経等の有料サイトはペイウォールで本文取得不可

**改善内容：**
- エラー種別を分類して保存（blocked / paywall / timeout / short / empty / error）
- スクラップブック画面でエラー理由を日本語表示
  - `⛔ Google Newsや有料サイトのURLはサーバー側でブロック`
  - `🔒 有料会員限定の記事です`
  - `⏱ 接続タイムアウト`
- RSSリード文（summary）をフォールバック表示（黄色ボーダーカード）

**変更ファイル：**
- `src/main/main.js`
- `src/renderer/assets/js/scrapbook.js`
- `src/renderer/assets/js/scrapbook-page.js`
- `src/renderer/assets/js/dashboard.js`
- `src/renderer/assets/css/main.css`

---

## 技術的判断・制約事項

### Google News 本文取得の構造的制限
| ケース | 原因 | 対処 |
|--------|------|------|
| Google News URL | HTTP 400（サーバーサイドブロック） | ❌ 回避不可 |
| 東洋経済・日経等 | 有料会員ページが返る | ❌ 回避不可 |
| ITmedia・Gigazine等 | 直接フェッチ可能 | ✅ Readabilityで正常取得 |

### URLの有効期限（参考）
| メディア | 有効期限 |
|---------|---------|
| NHK | 約1週間（削除される） |
| 朝日・日経 | 半永久（有料壁あり） |
| Google News | 数週間〜数ヶ月 |
| ITmedia・Gigazine | 半永久 |

### テキスト保存の容量（参考）
- 記事1本 = 約3〜5KB（テキストのみ）
- 100記事 = 約300〜500KB（localStorage で余裕）
- HTMLフル保存 = 200KB〜2MB/本（localStorageには不適・ローカルファイルに保存）

---

## 次回以降の課題（未着手）

| Phase | 内容 | 必要な準備 |
|-------|------|-----------|
| Phase 2 | Microsoft Graph API連携（Outlook/Teams） | Azure Client ID / Secret / Tenant ID |
| Phase 3 | Slack API連携 | Slack Bot Token / Team ID |
| Phase 4 | AI優先度判定（Claude API） | Anthropic API Key |
| Phase 7 | 統合テスト | 全Phase完了後 |

---

## 現在の動作状態

- ✅ Electronアプリとして起動可能（start.bat）
- ✅ RSSニュース取得（保険/AI/ITコンサル/一般）
- ✅ スクラップブック機能（☆登録・本文自動取得・HTML保存・アコーディオン表示）
- ✅ 優先度フィルター（サマリーカードクリック対応）
- ✅ デモタスク表示（Outlook/Teams/Slack）
- ⏳ 実データ連携（Graph API / Slack API）は未実装
