"""設定API（ツール選択・キーワード・同期間隔）"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class SettingsModel(BaseModel):
    tools: List[str] = ["outlook", "teams", "slack"]
    keywords: List[str] = ["お願いします", "ご対応", "確認してください", "対応お願い", "よろしくお願い"]
    sync_interval_minutes: int = 5

@router.get("/")
async def get_settings():
    # TODO: configファイルから読み込む
    return SettingsModel()

@router.post("/")
async def save_settings(settings: SettingsModel):
    # TODO: configファイルへ保存
    return {"status": "ok"}
