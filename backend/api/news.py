"""ニュースAPI（保険・AI・一般の3カテゴリ）"""
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_news():
    # TODO: Phase 6（News Soldier）で実装
    return {"news": [], "message": "Phase 6で実装予定"}
