"""ニュースデータモデル"""
from pydantic import BaseModel
from datetime import datetime

class NewsItem(BaseModel):
    id: str
    category: str        # "insurance" | "ai" | "general"
    title: str
    summary: str
    url: str
    source: str
    published_at: datetime
