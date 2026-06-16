"""
Outlook COM接続モジュール（win32com使用）
Azure ADアプリ登録不要・ローカルのOutlookに直接接続
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

CACHE_PATH = Path(__file__).parent.parent / "db" / "outlook_cache.json"


def _get_outlook():
    """
    Outlookアプリケーションへの接続を取得
    未起動の場合は起動を待ってリトライする（RPC_E_CALL_REJECTED対策）
    """
    try:
        import win32com.client
    except ImportError:
        raise RuntimeError("pywin32がインストールされていません。pip install pywin32 を実行してください。")

    import time
    last_err = None
    for attempt in range(3):  # 最大3回リトライ
        try:
            return win32com.client.Dispatch("Outlook.Application")
        except Exception as e:
            last_err = e
            # RPC_E_CALL_REJECTED (-2147418111) はOutlook起動中の一時的なエラー
            if attempt < 2:
                time.sleep(3)
    raise RuntimeError(f"Outlookに接続できません（起動しているか確認してください）: {last_err}")


def fetch_inbox_mails(max_items: int = 50, days_back: int = 7) -> list[dict]:
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
    inbox = ns.GetDefaultFolder(6)  # 6 = 受信トレイ

    items = inbox.Items
    items.Sort("[ReceivedTime]", True)  # 新着順

    cutoff = datetime.now() - timedelta(days=days_back)
    results = []

    for i, msg in enumerate(items):
        if i >= max_items:
            break
        try:
            received = msg.ReceivedTime
            # pywin32のDateTimeはpydatetimeに変換
            if hasattr(received, 'strftime'):
                received_dt = received
            else:
                from pywintypes import Time as PywintypesTime
                received_dt = datetime(
                    received.year, received.month, received.day,
                    received.hour, received.minute, received.second
                )

            if received_dt < cutoff:
                break  # 日付でソート済みなので古いものに達したら終了

            results.append({
                "id":           f"outlook_{msg.EntryID if hasattr(msg, 'EntryID') else i}",
                "source":       "outlook",
                "subject":      msg.Subject or "(件名なし)",
                "sender":       msg.SenderName or msg.SenderEmailAddress or "不明",
                "received_at":  received_dt.isoformat(),
                "body_snippet": (msg.Body or "")[:300].strip(),
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


def get_mails_with_fallback(max_items: int = 50, days_back: int = 7) -> dict:
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
