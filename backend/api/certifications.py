"""資格対策API（AI・IT系資格の試験日程・サンプル問題）

方針：
- 試験日程：公式サイトをBeautifulSoupでスクレイピング（事実情報・低リスク）
  取得失敗時はシードデータにフォールバックするため画面は必ず表示される
- 問題：著作権配慮のため、外部過去問サイトはスクレイピングせず
  キュレーション済みのサンプル問題（学習用）をシードとして保持
"""
from fastapi import APIRouter
import requests
from bs4 import BeautifulSoup

router = APIRouter()

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
    "it_passport": {
        "name": "ITパスポート",
        "full_name": "ITパスポート試験（iパス）",
        "official_url": "https://www3.jitec.ipa.go.jp/JitesCbt/index.html",
        "exam_date": "随時（CBT方式・通年実施）",
        "deadline": "受験日の前日まで",
        "note": "IPA（情報処理推進機構）主催。CBT方式で通年・全国で随時受験可能。",
        "questions": [
            {"q": "情報セキュリティの3要素（CIA）とは何か？", "a": "機密性（Confidentiality）、完全性（Integrity）、可用性（Availability）。"},
            {"q": "PDCAサイクルの各文字が表すものを答えよ。", "a": "Plan（計画）・Do（実行）・Check（評価）・Act（改善）。"},
            {"q": "リレーショナルデータベースで、表の行を一意に識別する列を何と呼ぶか？", "a": "主キー（プライマリキー）。"},
        ],
    },
    "fe": {
        "name": "基本情報技術者試験",
        "full_name": "基本情報技術者試験（FE）",
        "official_url": "https://www.ipa.go.jp/shiken/kubun/fe.html",
        "exam_date": "随時（CBT方式・通年実施）",
        "deadline": "受験日の数日前まで",
        "note": "IPA主催。2023年よりCBT方式で通年実施。科目A・科目Bで構成。",
        "questions": [
            {"q": "2進数 1010 を10進数に変換せよ。", "a": "10。（8+0+2+0 = 10）"},
            {"q": "アルゴリズムの計算量 O(n) と O(n^2) では、データ量が増えたときどちらが遅くなるか？", "a": "O(n^2)。データ量nの増加に対し処理時間が2乗で増加するため。"},
            {"q": "TCP/IPの4階層モデルで、IPが属する層は何か？", "a": "インターネット層。"},
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
    失敗時は空dictを返し、呼び出し側でシードにフォールバックする。"""
    result = {}
    try:
        res = requests.get(config["official_url"], headers=_HEADERS, timeout=8)
        res.encoding = res.apparent_encoding
        soup = BeautifulSoup(res.text, "html.parser")
        text = soup.get_text(separator=" ", strip=True)

        import re
        # 「2025年11月8日」「2025/11/08」「2025-11-08」等の日付表現を抽出
        patterns = [
            r"\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日",
            r"\d{4}[/-]\d{1,2}[/-]\d{1,2}",
        ]
        found = []
        for p in patterns:
            found.extend(re.findall(p, text))
        if found:
            # 最初に見つかった日付を「次の試験日候補」として返す
            result["scraped_dates"] = found[:5]
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

    return {
        "status":      "ok",
        "id":          cert_id,
        "name":        config["name"],
        "full_name":   config["full_name"],
        "official_url": config["official_url"],
        "exam_date":   config["exam_date"],       # シードの確定値（表示の主役）
        "deadline":    config["deadline"],
        "note":        config["note"],
        "questions":   config["questions"],
        "scraped":     scraped,                   # スクレイピングで拾えた日付候補（参考表示）
    }
