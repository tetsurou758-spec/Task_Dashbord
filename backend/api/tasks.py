"""タスク一覧API（Phase 2: Outlookキャッシュからタスクを返す）"""
from fastapi import APIRouter
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

router = APIRouter()

@router.get("/")
async def get_tasks():
    """
    Outlookキャッシュからメールを取得してタスク形式で返す
    Phase 4（AI優先度判定）実装まではキーワードで簡易判定
    """
    try:
        from outlook_com import load_cache
        from api.settings import load_settings
        cache = load_cache()
        mails = cache.get("mails", [])

        # 設定の検出キーワードでメールを絞り込む（いずれかを含むメールのみタスク化）
        settings = load_settings()
        keywords = settings.get("keywords", [])

        tasks = []
        for m in mails:
            text = (m["subject"] + " " + m["body_snippet"])
            # キーワード未設定時は全件、設定時はいずれか含むもののみ
            if keywords and not any(kw in text for kw in keywords):
                continue
            priority, reason = _simple_priority(m["subject"], m["body_snippet"])
            tasks.append({
                "id":           m["id"],
                "source":       "outlook",
                "subject":      m["subject"],
                "sender":       m["sender"],
                "received_at":  m["received_at"],
                "body_snippet": m["body_snippet"],
                "priority":     priority,
                "priority_reason": reason,
                "is_done":      False,
                "source_url":   "",
            })

        return {"tasks": tasks, "updated_at": cache.get("updated_at"), "source": "outlook_cache"}
    except Exception as e:
        return {"tasks": [], "error": str(e), "message": "Outlookキャッシュが見つかりません。同期ボタンを押してください。"}


def _simple_priority(subject: str, body: str) -> tuple[str, str]:
    """Phase 4（AI判定）までの簡易キーワード優先度判定"""
    text = (subject + " " + body).lower()
    high_kw = ["至急", "緊急", "urgent", "asap", "本日中", "今日中", "締切", "期限", "重要"]
    low_kw  = ["fyi", "ご参考", "ニュースレター", "newsletter", "案内", "お知らせ"]
    if any(k in text for k in high_kw):
        return "high", f"キーワード検出: {next(k for k in high_kw if k in text)}"
    if any(k in text for k in low_kw):
        return "low", f"キーワード検出: {next(k for k in low_kw if k in text)}"
    return "medium", "通常メール（Phase 4でAI判定予定）"
