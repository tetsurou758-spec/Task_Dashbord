"""資格対策API（AI・IT系資格の試験日程・サンプル問題）

方針：
- 試験日程：公式サイトをBeautifulSoupでスクレイピング（事実情報・低リスク）
  取得失敗時はシードデータにフォールバックするため画面は必ず表示される
- 問題：著作権配慮のため、外部過去問サイトはスクレイピングせず
  キュレーション済みのサンプル問題（学習用）をシードとして保持
"""
from fastapi import APIRouter
import os
import json
import re
import requests
from bs4 import BeautifulSoup

router = APIRouter()

# NotebookLM等で作成した問題集の置き場（cert_idごとに1ファイル）
#   questions_{cert_id}.md  … Markdown形式（## 問題文 / ### 解答）
#   questions_{cert_id}.json … [{"q": "...", "a": "..."}, ...]
try:
    from paths import data_dir
except ImportError:
    from backend.paths import data_dir
DATA_DIR = data_dir()


def _parse_markdown_questions(text: str) -> list[dict]:
    """Markdownを問題リストに変換する。
    形式: 「## …」で始まる行を問題、その下の「### …」以降を解答とみなす。
    （見出しレベルの揺れに強いよう ##/### を緩く解釈）"""
    questions = []
    # "## " 単位でブロック分割。先頭ブロック(blocks[0])は最初の## より前の
    # タイトル・前書き部分なので除外する
    blocks = re.split(r'(?m)^\s*##\s+(?!#)', text)
    for block in blocks[1:]:
        block = block.strip()
        if not block:
            continue
        # 解答区切り "### " で問題文と解答に分割
        parts = re.split(r'(?m)^\s*###\s+', block, maxsplit=1)
        q = parts[0].strip()
        a = parts[1].strip() if len(parts) > 1 else ""
        # 先頭の "Q1" "問1" 等のラベルは表示側で付け直すため軽く除去
        q = re.sub(r'^(Q\s*\d+|問\s*\d+)[\.\：:、]?\s*', '', q)
        a = re.sub(r'^(A|解答|答|解説)[\.\：:、]?\s*', '', a)
        # 解答内の任意の参考リンクを抽出（「参考: URL」or Markdownリンク）
        ref = ""
        m = re.search(r'(?m)^\s*(?:参考|ref)\s*[:：]\s*(\S+)\s*$', a)
        if not m:
            m = re.search(r'\[[^\]]*\]\((https?://\S+)\)', a)
        if m:
            ref = m.group(1)
            # 参考行を解答本文から取り除く
            a = re.sub(r'(?m)^\s*(?:参考|ref)\s*[:：].*$', '', a).strip()
        if q:
            questions.append({"q": q, "a": a, "ref": ref})
    return questions


def _load_external_questions(cert_id: str) -> list[dict] | None:
    """data/questions_{cert_id}.(md|json) があれば読み込む。無ければNone。"""
    md_path = os.path.join(DATA_DIR, f"questions_{cert_id}.md")
    json_path = os.path.join(DATA_DIR, f"questions_{cert_id}.json")
    try:
        if os.path.exists(json_path):
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            return [d for d in data if d.get("q")]
        if os.path.exists(md_path):
            with open(md_path, encoding="utf-8") as f:
                return _parse_markdown_questions(f.read())
    except Exception:
        return None
    return None

# 5資格の設定とシードデータ（スクレイピング失敗時のフォールバック）
CERT_CONFIG = {
    "g_kentei": {
        "name": "G検定",
        "full_name": "ジェネラリスト検定（G検定）",
        "official_url": "https://www.jdla.org/certificate/general/",
        "exam_date": "2025-11-08",
        "deadline": "2025-10-31",
        "note": "日本ディープラーニング協会（JDLA）主催。年6回程度実施。",
        "questions": [
            {"q": "ディープラーニングにおいて、勾配消失問題を緩和するために用いられる活性化関数は何か？", "a": "ReLU（Rectified Linear Unit）。シグモイド関数に比べ勾配消失が起こりにくい。"},
            {"q": "教師あり学習・教師なし学習・強化学習のうち、報酬を最大化する行動方針を学習するのはどれか？", "a": "強化学習。エージェントが環境との相互作用を通じて報酬を最大化する方策を学ぶ。"},
            {"q": "過学習（オーバーフィッティング）を抑制する代表的な手法を2つ挙げよ。", "a": "ドロップアウト、正則化（L1/L2）、データ拡張、早期終了など。"},
        ],
    },
    "genai_passport": {
        "name": "生成AIパスポート",
        "full_name": "生成AIパスポート試験",
        "official_url": "https://guga.or.jp/outline/",
        "exam_date": "2025-10-01",
        "deadline": "2025-09-20",
        "note": "一般社団法人 生成AI活用普及協会（GUGA）主催。年3回程度実施。",
        "questions": [
            {"q": "生成AIにおける「ハルシネーション」とは何か？", "a": "事実に基づかない、もっともらしい誤情報をAIが生成してしまう現象。"},
            {"q": "プロンプトエンジニアリングの基本的な考え方を説明せよ。", "a": "AIに与える指示（プロンプト）を工夫し、望ましい出力を引き出す技術。役割付与・具体化・例示などが有効。"},
            {"q": "生成AI利用時の著作権・個人情報に関する注意点を1つ挙げよ。", "a": "入力情報が学習に使われる可能性や、生成物が既存著作物に類似するリスクに注意する。"},
        ],
    },
    "ds_kentei": {
        "name": "DS検定",
        "full_name": "データサイエンティスト検定 リテラシーレベル",
        "official_url": "https://www.datascientist.or.jp/dskentei/",
        "exam_date": "2025-11-22",
        "deadline": "2025-10-30",
        "note": "データサイエンティスト協会主催。年2回程度実施。",
        "questions": [
            {"q": "平均値・中央値・最頻値のうち、外れ値の影響を最も受けにくいのはどれか？", "a": "中央値。データを順に並べた中央の値のため、極端な外れ値の影響を受けにくい。"},
            {"q": "相関と因果の違いを説明せよ。", "a": "相関は2変数が共に変動する関係。因果は一方が他方の原因である関係。相関があっても因果があるとは限らない。"},
            {"q": "教師あり学習で分類問題の評価に用いる指標を2つ挙げよ。", "a": "正解率（Accuracy）、適合率（Precision）、再現率（Recall）、F1スコア、AUCなど。"},
        ],
    },
    "ap": {
        "name": "応用情報技術者試験",
        "full_name": "応用情報技術者試験（AP）",
        "official_url": "https://www.ipa.go.jp/shiken/kubun/ap.html",
        "exam_date": "2025-10-12",
        "deadline": "2025-08-21",
        "note": "IPA主催。春期(4月)・秋期(10月)の年2回。午前(四択80問)・午後(記述5問)で構成。",
        "questions": [
            {"q": "ACID特性のうち、トランザクションが「全部成功」か「全部失敗」のいずれかになる性質は何か？", "a": "原子性（Atomicity）。"},
            {"q": "RAID5の特徴を、冗長性とディスク本数の観点から説明せよ。", "a": "パリティを分散配置し、ディスク1台の故障に耐える。最低3台必要で、実効容量は(n-1)台分。"},
            {"q": "公開鍵暗号方式で、送信者が受信者に暗号文を送る際に使う鍵はどれか？", "a": "受信者の公開鍵で暗号化し、受信者は自分の秘密鍵で復号する。"},
        ],
    },
    "python_ds": {
        "name": "Python資格",
        "full_name": "Python 3 エンジニア認定データ分析試験",
        "official_url": "https://www.pythonic-exam.com/exam/analyist",
        "exam_date": "随時（CBT方式・通年実施）",
        "deadline": "受験日の前日まで",
        "note": "一般社団法人Pythonエンジニア育成推進協会主催。NumPy・pandas・Matplotlib・scikit-learn等の data分析が範囲。CBTで通年受験可。",
        "questions": [
            {"q": "pandasで、CSVファイルを読み込んでDataFrameにする関数は何か？", "a": "pd.read_csv()。"},
            {"q": "NumPy配列 a の平均値を求めるメソッド／関数を答えよ。", "a": "a.mean() または np.mean(a)。"},
            {"q": "教師あり学習で、連続値を予測するタスクと、カテゴリを予測するタスクをそれぞれ何と呼ぶか？", "a": "連続値＝回帰（regression）、カテゴリ＝分類（classification）。"},
        ],
    },
}

# スクレイピング時のUA（ブロック回避のためブラウザを偽装）
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "ja,en;q=0.8",
}


def _scrape_exam_date(cert_id: str, config: dict) -> dict:
    """公式サイトから試験日らしき日付を抽出する（best-effort）。
    抽出した日付を正規化し、最も近い未来の日付を next_date として返す。
    失敗時は空dictを返し、呼び出し側でシードにフォールバックする。"""
    from datetime import date
    result = {}
    try:
        res = requests.get(config["official_url"], headers=_HEADERS, timeout=8)
        res.encoding = res.apparent_encoding
        soup = BeautifulSoup(res.text, "html.parser")
        text = soup.get_text(separator=" ", strip=True)

        # 「2025年11月8日」「2025/11/08」「2025-11-08」等を抽出して(年,月,日)に正規化
        candidates = []
        for m in re.finditer(r"(\d{4})\s*[年/\-]\s*(\d{1,2})\s*[月/\-]\s*(\d{1,2})", text):
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            try:
                candidates.append(date(y, mo, d))
            except ValueError:
                continue
        if candidates:
            today = date.today()
            future = sorted([d for d in candidates if d >= today])
            display = sorted(set(d.isoformat() for d in candidates))[:6]
            result["scraped_dates"] = display
            if future:
                result["next_date"] = future[0].isoformat()
    except Exception as e:
        result["scrape_error"] = str(e)
    return result


@router.get("/")
async def list_certifications():
    """資格一覧（タブ表示用）を返す"""
    return {
        "certifications": [
            {"id": cid, "name": c["name"]} for cid, c in CERT_CONFIG.items()
        ]
    }


@router.get("/{cert_id}")
async def get_certification(cert_id: str):
    """指定資格の試験日程・サンプル問題を返す。
    日程は公式サイトのスクレイピングを試み、失敗時はシードを使う。"""
    config = CERT_CONFIG.get(cert_id)
    if not config:
        return {"status": "error", "message": f"未知の資格ID: {cert_id}"}

    scraped = _scrape_exam_date(cert_id, config)

    # 試験日：公式サイトから取得できた最も近い未来の日付を優先、無ければシード
    if scraped.get("next_date"):
        exam_date = scraped["next_date"]
        exam_date_source = "web"
    else:
        exam_date = config["exam_date"]
        exam_date_source = "seed"

    # 外部問題集（NotebookLM等で作成）があればそれを優先、無ければシード
    external = _load_external_questions(cert_id)
    questions = external if external else config["questions"]
    question_source = "file" if external else "seed"

    # 各問題に参考リンクを付与（明示指定が無ければ問題文のWeb検索リンクを自動生成）
    from urllib.parse import quote_plus
    for q in questions:
        if not q.get("ref"):
            q["ref"] = "https://www.google.com/search?q=" + quote_plus(q["q"])

    return {
        "status":      "ok",
        "id":          cert_id,
        "name":        config["name"],
        "full_name":   config["full_name"],
        "official_url": config["official_url"],
        "exam_date":   exam_date,                  # web=公式取得 / seed=内蔵
        "exam_date_source": exam_date_source,
        "deadline":    config["deadline"],         # 締切は意味的特定が困難なためシード（公式要確認）
        "note":        config["note"],
        "questions":   questions,
        "question_source": question_source,        # file=外部問題集 / seed=内蔵サンプル
        "scraped":     scraped,                    # スクレイピングで拾えた日付候補（参考表示）
    }
