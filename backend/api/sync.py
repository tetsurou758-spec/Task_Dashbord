"""手動同期トリガーAPI（Phase 2: Outlook COM接続方式）"""
from fastapi import APIRouter
from datetime import datetime
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

router = APIRouter()

@router.post("/trigger")
async def trigger_sync():
    """Outlookから最新メールを取得してキャッシュを更新"""
    try:
        from outlook_com import get_mails_with_fallback
        from api.settings import load_settings
        s = load_settings()
        result = get_mails_with_fallback(
            max_items=s.get("outlook_max_items", 50),
            days_back=s.get("outlook_days_back", 90),
        )
        return {
            "status":     "ok",
            "source":     result["source"],
            "count":      len(result["mails"]),
            "updated_at": result.get("updated_at"),
            "error":      result.get("error"),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/status")
async def sync_status():
    """最終同期状態を返す"""
    try:
        from outlook_com import load_cache
        cache = load_cache()
        return {
            "last_synced": cache.get("updated_at"),
            "status":      "idle" if cache.get("updated_at") else "never",
            "cached_count": len(cache.get("mails", [])),
        }
    except Exception:
        return {"last_synced": None, "status": "idle", "cached_count": 0}
