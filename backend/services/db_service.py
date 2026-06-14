"""SQLiteデータベース操作（共通）"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '../../data/db/tasks.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """テーブル初期化（初回起動時に呼び出し）"""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            source_url TEXT,
            subject TEXT,
            sender TEXT,
            body_snippet TEXT,
            priority TEXT DEFAULT 'medium',
            priority_reason TEXT,
            is_task INTEGER DEFAULT 1,
            received_at TEXT,
            is_done INTEGER DEFAULT 0,
            done_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT,
            summary TEXT,
            url TEXT,
            source TEXT,
            published_at TEXT,
            cached_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    conn.commit()
    conn.close()
