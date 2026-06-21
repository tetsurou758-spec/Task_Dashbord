"""パス解決ユーティリティ

開発時とPyInstallerでexe化した本番時で、データの場所が変わるため吸収する。
- DATA_DIR  : 問題集など読み取り専用の同梱データ（exeと同じ場所/data）
- DB_DIR    : 設定・キャッシュなど書き込みデータ（本番はユーザー領域に保存）
"""
import os
import sys


def _is_frozen() -> bool:
    return getattr(sys, "frozen", False)


def data_dir() -> str:
    """読み取り専用の同梱データディレクトリ（questions_*.md 等）"""
    if _is_frozen():
        # PyInstaller onedir: exe と同じフォルダの data
        return os.path.join(os.path.dirname(sys.executable), "data")
    # 開発時: backend/data
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def db_dir() -> str:
    """書き込み用ディレクトリ（settings.json / outlook_cache.json 等）。
    本番は Program Files 直下に書けないため %APPDATA%\\TaskDashbord\\db を使う。"""
    if _is_frozen():
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        d = os.path.join(base, "TaskDashbord", "db")
    else:
        # 開発時: プロジェクトルート/db
        d = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "db")
    os.makedirs(d, exist_ok=True)
    return d
