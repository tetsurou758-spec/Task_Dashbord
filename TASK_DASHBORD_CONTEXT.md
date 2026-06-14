# Task_Dashbord - 要件定義書 & Bad Company マルチエージェント部隊構成

## プロジェクト概要

**プロジェクト名：** Task_Dashbord  
**形式：** ローカルデスクトップアプリケーション  
**目的：** 個人利用（テツロウさん専用）  
**ローカルディレクトリ：** `C:\Users\yoshi\OneDrive\ドキュメント\Task_Dashbord`  
**GitHubリポジトリ：** `https://github.com/tetsurou758-spec/Task_Dashbord`  
**実装ツール：** Claude Code（Cursor上）  
**マルチエージェント部隊名：** Bad Company（JoJo第4部・虹村億泰のスタンド「バッドカンパニー」より命名）

---

## コンセプト

Outlook・Teams・Slackから自分宛の依頼・タスク情報を定期取得し、AIで優先度判定してHTMLダッシュボードに表示。ダッシュボードからワンクリックで元ソース（メール・チャット）に遡及可能。さらに保険・AI・一般ニュースのサマリーも表示。ビジネスマンが日常的に感じる「情報過多・タスク管理の煩雑さ」を解決するツール。

---

## 主要機能要件

### 1. ツール連携機能
- **対応ツール：** Outlook、Teams、Slack の3つ
- **API：** Microsoft Graph API（Outlook・Teams）、Slack API（Slack）
- **取得方式：** 定期同期（ポーリング方式）
- **同期間隔：** ユーザー設定可能（デフォルト1〜5分程度）

### 2. データ抽出・フィルタリング
- 自分宛のメール・チャットメッセージを自動抽出
- AIで「依頼・タスク」に該当するか判定
- **カスタムキーワード指定：** 設定画面でユーザーが自由に追加・編集可能（例：「お願いします」「ご対応」「確認してください」など）
- **ツール選択：** Outlookのみ・Teamsのみ・Slackのみ・複数選択対応

### 3. AI優先度判定
- 抽出した依頼・タスクをAIが優先度（高・中・低）で判定
- 優先度判定にはClaude APIを使用
- コスト最小化のためキャッシュ活用

### 4. HTMLダッシュボード表示
- HTML/JavaScriptベースの専用ダッシュボード画面（独立ウィンドウ）
- タスク一覧を優先度順に表示
- 各タスク・メッセージをクリックすると、元のOutlook・Teams・Slackの該当画面を直接開く
- ニュース表示エリアを設置（保険・AI・一般ニュース 各3割）
- ニュースサマリーは無料で提供（外部RSS・スクレイピング活用）

### 5. 設定画面
以下の設定項目をUIから入力・変更可能：
- **使用ツールの選択：** Outlook / Teams / Slack（チェックボックス）
- **各ツールの認証情報入力：** Microsoft OAuth設定、Slack APIキーなど
- **抽出キーワードの入力ボックス：** カスタムキーワードの追加・削除
- **同期間隔の設定**

---

## 技術スタック（案）

| 項目 | 技術 |
|------|------|
| アプリ形式 | Electronベースのローカルデスクトップアプリ |
| フロントエンド | HTML / CSS / JavaScript |
| バックエンド | Python または Node.js |
| Outlook・Teams連携 | Microsoft Graph API（OAuth 2.0認証） |
| Slack連携 | Slack API（OAuth 2.0認証） |
| AI優先度判定 | Claude API（claude-sonnet-4-6） |
| ニュース取得 | RSSフィード / Webスクレイピング |
| データ保存 | ローカルSQLite または JSON |

---

## Bad Company - マルチエージェント部隊構成

JoJo第4部「バッドカンパニー」は小さな兵士たちが組織的に連携して戦うスタンド。同様に、6名の専門エージェントが役割分担して Task_Dashbord を完成させる。

---

### 🪖 Agent 1：General（司令官）
**役割：** プロジェクト全体の統括・進捗管理・他エージェントへの指示  
**担当タスク：**
- プロジェクト全体設計・ディレクトリ構成の決定
- 各エージェントへのタスク割り振り
- 実装の整合性確認・最終統合

---

### 🔌 Agent 2：Graph API Soldier（Microsoft連携担当）
**役割：** Microsoft Graph APIを使ったOutlook・Teams連携の実装  
**担当タスク：**
- Microsoft Azure ADでのアプリ登録・OAuth 2.0認証フロー実装
- Outlookメール取得API実装（自分宛フィルタリング）
- Teamsメッセージ取得API実装（自分宛フィルタリング）
- 定期同期ロジックの実装

---

### 💬 Agent 3：Slack Soldier（Slack連携担当）
**役割：** Slack APIを使ったSlack連携の実装  
**担当タスク：**
- Slack APIのOAuth認証フロー実装
- 自分宛のDM・メンション取得API実装
- 定期同期ロジックの実装
- Microsoft Graph APIとのデータ形式統合

---

### 🤖 Agent 4：AI Soldier（AI優先度判定担当）
**役割：** Claude APIを使った依頼・タスクの優先度判定ロジック実装  
**担当タスク：**
- Claude APIへのプロンプト設計（依頼・タスク判定・優先度判定）
- カスタムキーワードとのAI判定の組み合わせロジック
- APIコスト最小化のためのキャッシュ機能実装
- 優先度（高・中・低）のスコアリング設計

---

### 🎨 Agent 5：Dashboard Soldier（UI/UX・フロントエンド担当）
**役割：** HTMLダッシュボード画面の設計・実装  
**担当タスク：**
- ダッシュボードのHTML/CSS/JavaScript実装
- タスク一覧の優先度順表示
- ニュース表示エリア実装（保険・AI・一般 各3割）
- 元ソースへのワンクリック遷移機能実装
- 設定画面のUI実装（ツール選択・キーワード入力・認証情報入力）

---

### 📰 Agent 6：News Soldier（ニュース取得・サマリー担当）
**役割：** 保険・AI・一般ニュースの取得とサマリー生成  
**担当タスク：**
- 保険業界ニュースのRSSフィード・スクレイピング実装
- AIニュースのRSSフィード・スクレイピング実装
- 一般ニュースのRSSフィード・スクレイピング実装
- ニュースサマリー生成（無料・低コスト方式）
- キャッシュ管理（定期更新：朝・昼・夕方）

---

## 開発フェーズ（案）

| フェーズ | 内容 | 担当エージェント |
|----------|------|-----------------|
| Phase 1 | プロジェクト構成・環境セットアップ | General |
| Phase 2 | Microsoft Graph API連携実装 | Graph API Soldier |
| Phase 3 | Slack API連携実装 | Slack Soldier |
| Phase 4 | AI優先度判定ロジック実装 | AI Soldier |
| Phase 5 | ダッシュボードUI実装 | Dashboard Soldier |
| Phase 6 | ニュース機能実装 | News Soldier |
| Phase 7 | 統合テスト・最終調整 | General + 全員 |

---

## Claude Codeへの初回指示文（テンプレート）

```
あなたはTask_DashbordプロジェクトのマルチエージェントチームBad Companyです。
このプロジェクトはローカルデスクトップアプリで、Outlook・Teams・Slackから
自分宛の依頼・タスクを定期取得し、AI優先度判定してHTMLダッシュボードに表示します。

ローカルディレクトリ：C:\Users\yoshi\OneDrive\ドキュメント\Task_Dashbord
GitHubリポジトリ：https://github.com/tetsurou758-spec/Task_Dashbord

まずPhase 1として、プロジェクトのディレクトリ構成を設計し、
必要なパッケージ・依存関係を整理してください。
詳細な要件はCONTEXT.mdを参照してください。
```

---

*作成日：2026年6月15日*  
*プロジェクトオーナー：テツロウさん*  
*実装部隊：Bad Company（バッドカンパニー）*
