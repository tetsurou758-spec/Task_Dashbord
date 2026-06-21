"""
Outlook COM接続モジュール（win32com使用）
Azure ADアプリ登録不要・ローカルのOutlookに直接接続
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

try:
    from paths import db_dir
except ImportError:
    from backend.paths import db_dir
CACHE_PATH = Path(db_dir()) / "outlook_cache.json"


def _find_outlook_exe():
    """OUTLOOK.EXE のパスを自動探索する。見つからなければ None。"""
    import os, glob
    candidates = []
    # よくある固定パス（Office16/15、32/64bit、Click-to-Run）
    for base in [
        os.environ.get("ProgramFiles", r"C:\Program Files"),
        os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
    ]:
        if not base:
            continue
        candidates += [
            os.path.join(base, r"Microsoft Office\root\Office16\OUTLOOK.EXE"),
            os.path.join(base, r"Microsoft Office\root\Office15\OUTLOOK.EXE"),
            os.path.join(base, r"Microsoft Office\Office16\OUTLOOK.EXE"),
            os.path.join(base, r"Microsoft Office\Office15\OUTLOOK.EXE"),
        ]
        # ワイルドカードでも探索
        candidates += glob.glob(os.path.join(base, r"Microsoft Office\**\OUTLOOK.EXE"), recursive=True)
    for c in candidates:
        if c and os.path.exists(c):
            return c
    return None  # 見つからない場合はCOM側の起動に任せる


def _get_outlook():
    """
    Outlookアプリケーションへの接続を取得
    未起動の場合は起動を待ってリトライする（RPC_E_CALL_REJECTED対策）
    """
    try:
        import win32com.client
    except ImportError:
        raise RuntimeError("pywin32がインストールされていません。pip install pywin32 を実行してください。")

    import time, subprocess, os, glob

    # Outlook実行ファイルを自動探索（環境により設置場所が異なるため）
    outlook_exe = _find_outlook_exe()
    already_running = False
    try:
        result = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq OUTLOOK.EXE", "/NH"],
            capture_output=True, text=True
        )
        already_running = "OUTLOOK.EXE" in result.stdout
    except Exception:
        pass

    if not already_running and outlook_exe and os.path.exists(outlook_exe):
        subprocess.Popen(outlook_exe)
        time.sleep(10)  # 起動完了＋MAPI接続初期化待ち

    last_err = None
    for attempt in range(5):  # 最大5回リトライ（起動直後は時間がかかる）
        try:
            app = win32com.client.Dispatch("Outlook.Application")
            # GetNamespace で MAPI 接続確認（ここで「接続されていません」が出る場合あり）
            ns = app.GetNamespace("MAPI")
            ns.GetDefaultFolder(6)  # 受信トレイへのアクセスで初期化完了を確認
            return app
        except Exception as e:
            last_err = e
            if attempt < 4:
                time.sleep(5)  # 5秒待ってリトライ
    raise RuntimeError(f"Outlookに接続できません: {last_err}")


def _extract_latest_body(body: str) -> str:
    """返信時の引用（過去のメール）をカットして、直近の本文のみを抽出する"""
    if not body:
        return ""
    separators = [
        "________________________________",
        "From:",
        "差出人:",
        "Original Message",
        "-----Original Message-----",
        ">",
    ]
    min_idx = len(body)
    for sep in separators:
        # ">" は行頭の引用符としてよく使われるので改行とセットで判定
        search_str = "\n>" if sep == ">" else sep
        idx = body.find(search_str)
        if idx != -1 and idx < min_idx:
            min_idx = idx
    return body[:min_idx].strip()


def fetch_inbox_mails(max_items: int = 50, days_back: int = 90) -> list[dict]:
    """
    受信トレイから直近のメールを取得する

    Args:
        max_items: 最大取得件数
        days_back: 何日前までのメールを取得するか

    Returns:
        メール情報のリスト
    """
    outlook = _get_outlook()
    ns = outlook.GetNamespace("MAPI")
    from datetime import timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    results = []

    # 全アカウントの全フォルダを走査してメールを収集
    for acct_idx in range(1, ns.Folders.Count + 1):
        try:
            account_folder = ns.Folders.Item(acct_idx)
        except Exception:
            continue
        for folder_idx in range(1, account_folder.Folders.Count + 1):
            try:
                inbox = account_folder.Folders.Item(folder_idx)
                if inbox.Items.Count == 0:
                    continue
            except Exception:
                continue

            items = inbox.Items
            try:
                items.Sort("[ReceivedTime]", True)
            except Exception:
                pass

            for i, msg in enumerate(items):
                if len(results) >= max_items:
                    break
                try:
                    received = msg.ReceivedTime
                    if hasattr(received, 'strftime'):
                        received_dt = received
                    else:
                        received_dt = datetime(
                            received.year, received.month, received.day,
                            received.hour, received.minute, received.second
                        )
                    if received_dt < cutoff:
                        break
                    results.append({
                        "id":           f"outlook_{msg.EntryID if hasattr(msg, 'EntryID') else i}",
                        "source":       "outlook",
                        "subject":      msg.Subject or "(件名なし)",
                        "sender":       msg.SenderName or msg.SenderEmailAddress or "不明",
                        "received_at":  received_dt.isoformat(),
                        "body_snippet": (msg.Body or "")[:300].strip(),
                        "latest_body":  _extract_latest_body(msg.Body or ""),
                        "unread":       bool(msg.UnRead),
                        "to":           msg.To or "",
                        "cc":           msg.CC or "",
                    })
                except Exception:
                    continue

    return results


def fetch_flagged_mails() -> list[dict]:
    """フラグ付きメールを取得"""
    outlook = _get_outlook()
    ns = outlook.GetNamespace("MAPI")
    inbox = ns.GetDefaultFolder(6)

    items = inbox.Items
    items.Sort("[ReceivedTime]", True)

    results = []
    for i, msg in enumerate(items):
        if i >= 200:
            break
        try:
            # FlagStatus: 0=フラグなし, 2=フラグあり
            if getattr(msg, 'FlagStatus', 0) == 2:
                results.append({
                    "id":           f"outlook_flag_{i}",
                    "source":       "outlook",
                    "subject":      msg.Subject or "(件名なし)",
                    "sender":       msg.SenderName or "",
                    "received_at":  str(msg.ReceivedTime),
                    "body_snippet": (msg.Body or "")[:300].strip(),
                    "latest_body":  _extract_latest_body(msg.Body or ""),
                    "flagged":      True,
                })
        except Exception:
            continue
    return results


def save_cache(mails: list[dict]) -> None:
    """取得結果をJSONキャッシュに保存"""
    CACHE_PATH.parent.mkdir(exist_ok=True)
    cache = {
        "updated_at": datetime.now().isoformat(),
        "mails":      mails,
    }
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def load_cache() -> dict:
    """キャッシュを読み込む（Outlookが起動していない場合のフォールバック）"""
    if CACHE_PATH.exists():
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"updated_at": None, "mails": []}


def get_mails_with_fallback(max_items: int = 50, days_back: int = 90) -> dict:
    """
    Outlookから取得（失敗時はキャッシュを返す）
    フロントエンド向けのメイン関数
    """
    try:
        mails = fetch_inbox_mails(max_items=max_items, days_back=days_back)
        save_cache(mails)
        return {
            "source":     "live",
            "updated_at": datetime.now().isoformat(),
            "mails":      mails,
        }
    except RuntimeError as e:
        cache = load_cache()
        return {
            "source":     "cache",
            "updated_at": cache.get("updated_at"),
            "error":      str(e),
            "mails":      cache.get("mails", []),
        }
