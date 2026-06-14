// バックエンド未接続時に使うデモデータ
const DEMO_TASKS = [
  {
    id: 'd1', source: 'outlook', source_url: 'https://outlook.office.com',
    subject: '【至急】保険契約更新の件、ご対応をお願いします',
    sender: '田中 部長', body_snippet: 'お疲れ様です。来週の期限が迫っておりますので、至急ご確認いただき、契約書類の準備を進めていただきますようお願いいたします。',
    priority: 'high', priority_reason: '「至急」「期限が迫っている」など緊急性の高いキーワードを含む',
    is_task: true, received_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), is_done: false,
  },
  {
    id: 'd2', source: 'teams', source_url: 'https://teams.microsoft.com',
    subject: '新規顧客向け提案資料のレビューをお願いできますか？',
    sender: '山田 営業', body_snippet: '先日の商談で使用する提案資料を作成しました。明日の午前中までにご確認いただけると助かります。SharePointに共有しています。',
    priority: 'high', priority_reason: '明日の午前中というデッドラインがあり、ビジネス上重要な依頼',
    is_task: true, received_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(), is_done: false,
  },
  {
    id: 'd3', source: 'slack', source_url: 'https://slack.com',
    subject: 'Q3 売上レポートの数値確認お願いします @me',
    sender: '佐藤 マネージャー', body_snippet: '先ほど送ったレポートの3ページ目の数値が前回と異なるようです。確認して修正版を送っていただけますか？',
    priority: 'high', priority_reason: 'マネージャーからのメンションで数値の誤りに関する修正依頼',
    is_task: true, received_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(), is_done: false,
  },
  {
    id: 'd4', source: 'outlook', source_url: 'https://outlook.office.com',
    subject: '来週の定例会議アジェンダについて',
    sender: '鈴木 課長', body_snippet: '来週月曜の定例会議ですが、アジェンダに追加したい議題があれば今週中に教えてください。よろしくお願いします。',
    priority: 'medium', priority_reason: '今週中という期限はあるが、緊急度は中程度',
    is_task: true, received_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), is_done: false,
  },
  {
    id: 'd5', source: 'teams', source_url: 'https://teams.microsoft.com',
    subject: 'システム移行テストへの協力依頼',
    sender: 'IT部門 渡辺', body_snippet: '来月予定のシステム移行に向けて、ユーザー受け入れテストへのご協力をお願いしております。日程調整のご連絡をお待ちしています。',
    priority: 'medium', priority_reason: '来月というスケジュールで、テスト協力という具体的なアクションが必要',
    is_task: true, received_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), is_done: false,
  },
  {
    id: 'd6', source: 'slack', source_url: 'https://slack.com',
    subject: '社内勉強会の講師候補、何か良いアイデアありますか？',
    sender: '伊藤 リーダー', body_snippet: '次回の社内勉強会（来月予定）のテーマを探しています。AI・DX系で面白そうなテーマがあれば教えてください！',
    priority: 'low', priority_reason: '来月予定で緊急性は低く、情報収集的な質問',
    is_task: false, received_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), is_done: false,
  },
  {
    id: 'd7', source: 'outlook', source_url: 'https://outlook.office.com',
    subject: '先日の打ち合わせのお礼',
    sender: '小林 部長（取引先）', body_snippet: '先日はお時間をいただきありがとうございました。引き続きよろしくお願いいたします。',
    priority: 'low', priority_reason: 'お礼メールでアクション不要',
    is_task: false, received_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), is_done: true,
  },
];

const DEMO_NEWS = {
  insurance: [
    { id: 'n1', title: '大手損保3社、サイバー保険の引受基準を強化', summary: 'ランサムウェア被害増加を受け、セキュリティ要件を満たさない企業への引受を制限へ。', source: '保険毎日新聞', url: '#', published_at: new Date(Date.now() - 1000*60*60*2).toISOString() },
    { id: 'n2', title: '自動車保険、テレマティクス型が前年比30%増', summary: '走行データに基づく割引型保険が若年層を中心に急拡大。主要各社が商品拡充を加速。', source: '日本経済新聞', url: '#', published_at: new Date(Date.now() - 1000*60*60*4).toISOString() },
    { id: 'n3', title: '金融庁、保険代理店のDX推進に向けガイドライン策定へ', summary: 'デジタル化による顧客利便性向上と適切な情報管理の両立を目的とした指針を年内に公表予定。', source: '金融庁', url: '#', published_at: new Date(Date.now() - 1000*60*60*6).toISOString() },
    { id: 'n4', title: '地震保険加入率、過去最高の36%に', summary: '能登半島地震を契機に加入意識が高まり、前年から3ポイント上昇。', source: '損保協会', url: '#', published_at: new Date(Date.now() - 1000*60*60*10).toISOString() },
  ],
  ai: [
    { id: 'n5', title: 'Claude 4シリーズ、エンタープライズ向け機能を強化', summary: 'Anthropicが企業向け機能を拡充。長文コンテキスト処理と多言語対応が大幅改善。', source: 'TechCrunch Japan', url: '#', published_at: new Date(Date.now() - 1000*60*60*1).toISOString() },
    { id: 'n6', title: '生成AI市場、2026年に5兆円規模へ拡大予測', summary: 'IDCの調査によると、日本国内の生成AI関連投資は2026年に前年比2倍以上に。', source: 'IDC Japan', url: '#', published_at: new Date(Date.now() - 1000*60*60*5).toISOString() },
    { id: 'n7', title: 'Microsoft 365 Copilot、日本語精度が大幅向上', summary: 'メール・会議要約・文書作成における日本語の自然な表現が改善。', source: 'Microsoft', url: '#', published_at: new Date(Date.now() - 1000*60*60*8).toISOString() },
  ],
  itconsult: [
    { id: 'n11', title: 'アクセンチュア、日本企業向けDX支援を強化　AI活用で業務改革加速', summary: '生成AIを活用した業務プロセス改革サービスを拡充。製造・金融・流通向けに特化したソリューションを提供開始。', source: 'ZDNet Japan', url: '#', published_at: new Date(Date.now() - 1000*60*60*1).toISOString() },
    { id: 'n12', title: '国内DX投資、2026年に3.5兆円超へ　ITコンサル需要が急拡大', summary: 'IDC調査によると企業のデジタル変革投資は前年比22%増。特にクラウド移行とAI導入支援の需要が高い。', source: 'ITmedia エンタープライズ', url: '#', published_at: new Date(Date.now() - 1000*60*60*3).toISOString() },
    { id: 'n13', title: 'NTTデータ、SAP S/4HANA移行支援で大手製造業と大型契約', summary: '2027年のSAP ECC保守終了に向けた移行需要を取り込み。移行コスト削減のテンプレート展開を推進。', source: '日本経済新聞', url: '#', published_at: new Date(Date.now() - 1000*60*60*5).toISOString() },
    { id: 'n14', title: 'デロイト トーマツ、生成AI導入支援サービスを本格展開', summary: 'ChatGPT・Claude等を活用した業務効率化支援を各業界向けに提供。ROI測定フレームワークも併せて提供。', source: 'ZDNet Japan', url: '#', published_at: new Date(Date.now() - 1000*60*60*8).toISOString() },
  ],
  general: [
    { id: 'n8', title: '日銀、追加利上げの可能性を示唆', summary: '植田総裁、経済・物価情勢が見通し通りなら金融緩和の調整を継続と発言。', source: '日本経済新聞', url: '#', published_at: new Date(Date.now() - 1000*60*60*2).toISOString() },
    { id: 'n9', title: '2026年夏の参院選、各党が公約取りまとめへ', summary: '与野党各党が政策立案を本格化。経済政策・社会保障改革が争点の中心に。', source: '朝日新聞', url: '#', published_at: new Date(Date.now() - 1000*60*60*3).toISOString() },
    { id: 'n10', title: '梅雨入り宣言、関東は平年より1週間遅れ', summary: '気象庁、関東甲信の梅雨入りを発表。今年は気温高めで蒸し暑い夏の見通し。', source: '気象庁', url: '#', published_at: new Date(Date.now() - 1000*60*60*5).toISOString() },
  ],
};
