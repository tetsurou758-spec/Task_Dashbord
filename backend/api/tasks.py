"""タスク一覧API（AI優先度判定済みタスクをDBから返す）"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_tasks():
    # TODO: Phase 4（AI Soldier）で実装
    return {"tasks": [], "message": "Phase 4で実装予定"}
