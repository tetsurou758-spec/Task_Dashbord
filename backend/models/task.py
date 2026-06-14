"""タスクデータモデル"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Task(BaseModel):
    id: str
    source: str                   # "outlook" | "teams" | "slack"
    source_url: str               # 元ソースへのディープリンク
    subject: str                  # メール件名 or メッセージ抜粋
    sender: str                   # 送信者名
    body_snippet: str             # 本文の先頭100文字程度
    priority: str                 # "high" | "medium" | "low"
    priority_reason: str          # AIが判定した理由
    is_task: bool                 # AIがタスク判定したか
    received_at: datetime
    is_done: bool = False
    done_at: Optional[datetime] = None
