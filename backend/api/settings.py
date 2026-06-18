"""設定API（ツール選択・キーワード・同期間隔・Outlook取得設定）"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import json, os

router = APIRouter()

SETTINGS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "settings.json")

DEFAULT_SETTINGS = {
    "tools": ["outlook", "teams", "slack"],
    "keywords": ["お願いします", "ご対応", "確認してください", "対応お願い", "よろしくお願い"],
    "sync_interval_minutes": 5,
    "outlook_days_back": 90,
    "outlook_max_items": 50,
}

class SettingsModel(BaseModel):
    tools: List[str] = ["outlook", "teams", "slack"]
    keywords: List[str] = ["お願いします", "ご対応", "確認してください", "対応お願い", "よろしくお願い"]
    sync_interval_minutes: int = 5
    outlook_days_back: int = 90
    outlook_max_items: int = 50

def load_settings() -> dict:
    if os.path.exists(SETTINGS_PATH):
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            saved = json.load(f)
        return {**DEFAULT_SETTINGS, **saved}
    return DEFAULT_SETTINGS.copy()

def save_settings_to_file(data: dict):
    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@router.get("/")
async def get_settings():
    return load_settings()

@router.post("/")
async def save_settings(settings: SettingsModel):
    save_settings_to_file(settings.dict())
    return {"status": "ok"}
