"""バックエンドエントリーポイント（FastAPI + APScheduler）"""
import os
from dotenv import load_dotenv
load_dotenv()

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import tasks_router, news_router, settings_router, sync_router, certifications_router

app = FastAPI(title="Task Dashbord API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/api/tasks")
app.include_router(news_router, prefix="/api/news")
app.include_router(settings_router, prefix="/api/settings")
app.include_router(sync_router, prefix="/api/sync")
app.include_router(certifications_router, prefix="/api/certifications")

if __name__ == "__main__":
    port = int(os.getenv("BACKEND_PORT", 8001))
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=False)
