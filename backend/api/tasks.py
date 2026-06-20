"""タスク一覧API（Phase 2: Outlookキャッシュからタスクを返す）"""
from fastapi import APIRouter
from pydantic import BaseModel
import sys, os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

router = APIRouter()


class OpenMailModel(BaseModel):
    id: str


@router.post("/open")
async def open_mail(req: OpenMailModel):
    """タスクIDからOutlookの元メールを開く（id形式: outlook_{EntryID}）"""
    try:
        if not req.id.startswith("outlook_"):
            return {"status": "error", "message": "Outlookメールではありません"}
        entry_id = req.id[len("outlook_"):]
        import win32com.client
        app = win32com.client.Dispatch("Outlook.Application")
        ns = app.GetNamespace("MAPI")
        mail = ns.GetItemFromID(entry_id)
        mail.Display()  # Outlookで元メールを開く
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/")
async def get_tasks():
    """
    Outlookキャッシュからメールを取得してタスク形式で返す
    Phase 4（AI優先度判定）実装まではキーワードで簡易判定
    """
    try:
        from outlook_com import load_cache
        from api.settings import load_settings
        cache = load_cache()
        mails = cache.get("mails", [])

        # 設定からキーワードと判定条件を取得
        settings = load_settings()
        keywords = settings.get("keywords", [])
        mentions = settings.get("mentions", [])
        condition = settings.get("keyword_condition", "OR")
        check_to_only = settings.get("check_to_only", False)

        tasks = []
        for m in mails:
            # 「宛先 (To)」の確認オプションが有効な場合、Toフィールドにメンションキーワードが含まれるかチェック
            if check_to_only and mentions:
                to_field = m.get("to", "")
                if not any(mn in to_field for mn in mentions):
                    continue

            # 直近の本文（抽出されていなければスニペット）を判定対象にする
            text_to_check = m.get("latest_body", m["body_snippet"])
            
            has_keyword = any(kw in text_to_check for kw in keywords) if keywords else False
            has_mention = any(mn in text_to_check for mn in mentions) if mentions else False
            
            # 判定ロジック
            is_task = False
            if condition == "AND":
                if keywords and mentions:
                    is_task = has_keyword and has_mention
                elif keywords:
                    is_task = has_keyword
                elif mentions:
                    is_task = has_mention
                else:
                    is_task = True
            else: # OR
                if keywords or mentions:
                    is_task = has_keyword or has_mention
                else:
                    is_task = True
                    
            if not is_task:
                continue

            priority, reason = _simple_priority(m["subject"], text_to_check, has_mention)
            tasks.append({
                "id":           m["id"],
                "source":       "outlook",
                "subject":      m["subject"],
                "sender":       m["sender"],
                "received_at":  m["received_at"],
                "body_snippet": m["body_snippet"],
                "priority":     priority,
                "priority_reason": reason,
                "is_done":      False,
                "source_url":   "",
            })

        return {"tasks": tasks, "updated_at": cache.get("updated_at"), "source": "outlook_cache"}
    except Exception as e:
        return {"tasks": [], "error": str(e), "message": "Outlookキャッシュが見つかりません。同期ボタンを押してください。"}


def _simple_priority(subject: str, body: str, has_mention: bool = False) -> tuple[str, str]:
    """Phase 4（AI判定）までの簡易キーワード優先度判定"""
    text = (subject + " " + body).lower()
    high_kw = ["至急", "緊急", "urgent", "asap", "本日中", "今日中", "締切", "期限", "重要"]
    low_kw  = ["fyi", "ご参考", "ニュースレター", "newsletter", "案内", "お知らせ"]
    
    if any(k in text for k in high_kw):
        return "high", f"キーワード検出: {next(k for k in high_kw if k in text)}"
        
    if has_mention:
        return "high", "自分宛てのメンションを検出"
        
    if any(k in text for k in low_kw):
        return "low", f"キーワード検出: {next(k for k in low_kw if k in text)}"
        
    return "medium", "通常メール（直近本文からタスク化）"
