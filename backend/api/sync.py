"""手動同期トリガーAPI"""
from fastapi import APIRouter

router = APIRouter()

@router.post("/trigger")
async def trigger_sync():
    # TODO: Phase 2・3（Graph API / Slack Soldier）で実装
    return {"status": "ok", "message": "Phase 2・3で実装予定"}

@router.get("/status")
async def sync_status():
    return {"last_synced": None, "status": "idle"}
