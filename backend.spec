# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec: FastAPIバックエンドを backend.exe（onedir）に固める
# ビルド: pyinstaller backend.spec --noconfirm --distpath pybuild
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = [("backend/data", "data")]      # 問題集など同梱データ → exeと同じ場所/data
binaries = []
hiddenimports = []

# 動的importされがちなパッケージをまとめて収集
for pkg in ["uvicorn", "fastapi", "starlette", "anyio", "feedparser"]:
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# 自作モジュール・COM関連
hiddenimports += collect_submodules("api")
hiddenimports += [
    "paths",
    "api.tasks", "api.news", "api.settings", "api.sync", "api.certifications",
    "win32com", "win32com.client", "pythoncom", "pywintypes",
    "requests", "bs4", "dotenv",
]

a = Analysis(
    ["backend/app.py"],
    pathex=["backend"],         # `from api import ...` を解決するため
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="backend",
    console=True,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe, a.binaries, a.datas,
    strip=False, upx=True, upx_exclude=[],
    name="backend",
)
