# Task_Dashbord 進捗ログ Session 2（2026-06-16）

**日付：** 2026年6月16日（深夜〜明け方）  
**プロジェクトオーナー：** テツロウさん  
**実装部隊：** Bad Company（バッドカンパニー）  
**担当：** Claude Sonnet 4.6

---

## セッション概要

Session 1 のハイブリッドニュース取得実装後の追加改善セッション。  
ニュースソースの細かな調整・HTML保存の不具合修正・削除処理の完全化を実施。

---

## 完了タスク

### ✅ 1. ニュース一覧20件化・一般ソース朝日→日経・HTML保存リダイレクト警告解消（fix）
**コミット：** `d9a7d77`

**対応内容：**
- `news-rss.js`: ニュース一覧の最大件数を12件→20件に拡大（直接RSSソースが埋もれにくくなる）
- `news-rss.js`: 一般カテゴリのニュースソースを朝日新聞（テツロウさんの意向でNG）→日経新聞に変更
- `main.js`: HTML丸ごと保存時に `<meta http-equiv="refresh">` タグを除去
  - 一部サイトのHTMLに埋め込まれたリダイレクトタグがローカルファイルを開いた際にブラウザの「リダイレクトの警告」を引き起こしていたため

**判明した事実：**
- 100文字問題：朝日・日経はペイウォールのため、RSSのリード文（冒頭100文字程度）しか取得できない
  → 日経に変えても同様だが「ソース元が日経」になることに意味がある

---

### ✅ 2. Google News記事のHTML保存ボタンを無効化・一般ソースNHK除外/Yahoo追加（fix）
**コミット：** `fef67cc`

**対応内容：**
- `scrapbook-page.js`: gnews記事（text_fetch_error === 'gnews'）の「丸ごと保存」ボタンをdisabled化
  - Google NewsページのHTMLは実記事ではなくリダイレクトページのため保存しても無意味
  - これが「リダイレクトの警告」の主な原因だった
  - ボタンを「💾 保存不可」グレーアウト表示に変更
- `news-rss.js`: 一般カテゴリからNHKを除外（テツロウさんの意向）
- `news-rss.js`: 一般カテゴリにYahoo!ニュース（トップピックス）を追加

---

### ✅ 3. 日経新聞RSSが機能しない問題を調査・Yahoo!ビジネスに変更（fix）
**コミット：** `024c185`

**調査結果：**
```
https://www.nikkei.com/rss/index.rdf → 404
https://www.nikkei.com/rss/top.html  → 404
https://www.nikkei.com/rss/          → 404
https://r.nikkei.com/rss             → 404
```
**日経新聞はRSSフィードを完全廃止していることが判明。**

**対応：**
- `news-rss.js`: 日経新聞（廃止済み）→ Yahoo!ニュース ビジネス（`topics/business.xml` / 200 OK）に変更
- 一般カテゴリ：Yahoo!トップ ＋ Yahoo!ビジネスの2本立てに確定

---

### ✅ 4. 「すべて削除」時にHTML保存ファイルも削除するよう修正（fix）
**コミット：** `046b465`

**問題：**
- 個別「★ 解除」ボタン → HTMLファイルも削除 ✅（元々正常）
- 「すべて削除」ボタン → localStorageのみ削除、HTMLファイルが `%APPDATA%\Task Dashbord\scraps\` に残ったまま ❌

**修正：**
- `scrapbook-page.js`: 削除対象の `filtered` 配列をループして `html_path` があれば `deleteArticleHtml` で削除
- `async` 化（HTMLファイル削除を await）
- confirm ダイアログに「丸ごと保存済みのHTMLファイルも削除されます」の文言を追加

---

## RSS ソース最終構成（2026-06-16 時点）

### 保険カテゴリ
| ソース | 種別 | 本文取得 |
|---|---|---|
| 金融庁 | 直接RSS | ✅ |
| PR TIMES（損害保険） | 直接RSS（要疎通確認） | ✅ |
| PR TIMES（保険代理店） | 直接RSS（要疎通確認） | ✅ |
| ITmedia 産業ニュース | 直接RSS | ✅ |
| Google News（損害保険） | Google News RSS | ❌ gnews案内 |
| Google News（損保・代理店） | Google News RSS | ❌ gnews案内 |

### AIカテゴリ
| ソース | 種別 | 本文取得 |
|---|---|---|
| Gigazine | 直接RSS | ✅ |
| TechCrunch Japan | 直接RSS | ✅ |
| ITmedia AI+ | 直接RSS | ✅ |

### ITコンサルカテゴリ
| ソース | 種別 | 本文取得 |
|---|---|---|
| ITmedia エンタープライズ | 直接RSS | ✅ |
| ZDNet Japan | 直接RSS | ✅ |
| @IT | 直接RSS | ✅ |
| 日経クロステック | 直接RSS（有料記事あり） | △ |

### 一般カテゴリ
| ソース | 種別 | 本文取得 |
|---|---|---|
| Yahoo!ニュース トップ | 直接RSS | ✅ |
| Yahoo!ニュース ビジネス | 直接RSS | ✅ |

---

## 技術的判断事項

### 朝日新聞について
テツロウさんの意向により除外（「リベラルなので嫌い」）

### 日経新聞について
RSS廃止のため取得不可。代替としてYahoo!ビジネスを採用。  
Yahoo!ビジネスには日経記事の転載が含まれることがある。

### HTML保存のリダイレクト警告について
原因は2つ：
1. 一部サイトのHTMLに `<meta http-equiv="refresh">` が埋め込まれていた → 保存時に除去
2. Google NewsページのHTMLを保存していた（実記事でなくリダイレクトページ）→ gnews記事の保存ボタンを無効化

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/main/main.js` | HTML保存時にmeta-refreshを除去 |
| `src/renderer/assets/js/news-rss.js` | ソース変更・20件化 |
| `src/renderer/assets/js/scrapbook-page.js` | gnews保存ボタン無効化・すべて削除でHTMLも削除 |

---

## 次回以降の課題（未着手）

| Phase | 内容 | 必要な準備 |
|-------|------|-----------|
| Phase 2 | Microsoft Graph API連携（Outlook/Teams） | Azure Client ID / Secret / Tenant ID |
| Phase 3 | Slack API連携 | Slack Bot Token / Team ID |
| Phase 4 | AI優先度判定（Claude API） | Anthropic API Key |
| Phase 7 | 統合テスト | 全Phase完了後 |

---

## 備考

PR TIMESの直接RSSは疎通未確認（`prtimes.jp/rss/keyword/損害保険.rss` が正しいURL形式か不明）。  
保険カテゴリのPR TIMES記事は現状Google News経由で表示されている可能性が高い。  
次回、直接RSSのURLを正式確認すること。
