"""ニュース取得サービス（RSSフィード）"""
import feedparser
import hashlib
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

# カテゴリ別RSSフィード一覧
RSS_FEEDS = {
    "insurance": [
        {"url": "https://news.google.com/rss/search?q=損害保険+生命保険&hl=ja&gl=JP&ceid=JP:ja", "source": "Google News"},
        {"url": "https://news.google.com/rss/search?q=損保+代理店+保険業法&hl=ja&gl=JP&ceid=JP:ja", "source": "Google News"},
        {"url": "https://www.fsa.go.jp/news/rss.xml", "source": "金融庁"},
    ],
    "ai": [
        {"url": "https://jp.techcrunch.com/feed/",               "source": "TechCrunch Japan"},
        {"url": "https://www.itmedia.co.jp/news/subtop/aiplus/index.rdf", "source": "ITmedia AI+"},
        {"url": "https://gigazine.net/news/rss_2.0/",            "source": "Gigazine"},
        {"url": "https://ainow.ai/feed/",                        "source": "AINOW"},
    ],
    "general": [
        {"url": "https://www3.nhk.or.jp/rss/news/cat0.xml",      "source": "NHK"},
        {"url": "https://rss.asahi.com/rss/asahi/newsheadlines.rdf", "source": "朝日新聞"},
        {"url": "https://rss.nikkei.com/rss/nkd/news.rdf",       "source": "日本経済新聞"},
    ],
    "itconsult": [
        {"url": "https://www.itmedia.co.jp/enterprise/subtop/features/rss.xml", "source": "ITmedia エンタープライズ"},
        {"url": "https://japan.zdnet.com/rss/index.rdf",          "source": "ZDNet Japan"},
        {"url": "https://rss.itmedia.co.jp/rss/2.0/ait.xml",     "source": "@IT"},
        {"url": "https://xtech.nikkei.com/rss/index.rdf",         "source": "日経クロステック"},
    ],
}

# AI・保険関連キーワードフィルター（AIカテゴリで絞り込み）
AI_KEYWORDS = ['AI', '人工知能', '機械学習', 'ChatGPT', 'Claude', 'Gemini', 'LLM', '生成AI', 'OpenAI', 'Anthropic', 'Microsoft', 'Google']
INSURANCE_KEYWORDS = ['保険', '損保', '生保', '共済', '代理店', '金融庁', '損害', 'リスク', '契約', '更新']
ITCONSULT_KEYWORDS = ['DX', 'デジタル変革', 'ITコンサル', 'クラウド', 'システム導入', 'ERP', 'SAP', 'アクセンチュア', 'デロイト', 'マッキンゼー', 'NTTデータ', '富士通', 'IT戦略', 'デジタル']

def _parse_date(entry) -> str:
    """feedparserのエントリから日時文字列を取得"""
    try:
        if hasattr(entry, 'published'):
            dt = parsedate_to_datetime(entry.published)
            return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()

def _make_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()[:12]

def _matches_keywords(text: str, keywords: list) -> bool:
    text_lower = text.lower()
    return any(kw.lower() in text_lower for kw in keywords)

def fetch_news(category: str, limit: int = 10) -> list:
    """指定カテゴリのRSSを取得してニュースリストを返す"""
    feeds = RSS_FEEDS.get(category, [])
    items = []

    for feed_info in feeds:
        try:
            parsed = feedparser.parse(feed_info["url"])
            for entry in parsed.entries[:5]:
                title   = entry.get("title", "").strip()
                summary = entry.get("summary", entry.get("description", "")).strip()
                url     = entry.get("link", "")

                # HTMLタグを除去（簡易）
                import re
                summary = re.sub(r'<[^>]+>', '', summary)
                summary = summary[:120] + ('...' if len(summary) > 120 else '')

                # AIカテゴリはキーワードでフィルタリング
                if category == "ai" and not _matches_keywords(title + summary, AI_KEYWORDS):
                    continue
                if category == "insurance" and not _matches_keywords(title + summary, INSURANCE_KEYWORDS):
                    continue
                if category == "itconsult" and not _matches_keywords(title + summary, ITCONSULT_KEYWORDS):
                    continue

                if not title or not url:
                    continue

                items.append({
                    "id":           _make_id(url),
                    "category":     category,
                    "title":        title,
                    "summary":      summary,
                    "url":          url,
                    "source":       feed_info["source"],
                    "published_at": _parse_date(entry),
                })
        except Exception as e:
            print(f"[news_service] RSS取得失敗: {feed_info['url']} - {e}")
            continue

    # 日時降順にソート
    items.sort(key=lambda x: x["published_at"], reverse=True)
    return items[:limit]
