import logging

from sqlalchemy.orm import Session

from guet_notifier.models import TestPusherDelivery

logger = logging.getLogger("guet_notifier.pushers")


def send(
    db: Session,
    *,
    user_id: int,
    rule_id: int,
    notification_item_id: int,
    channel_key: str,
    payload: dict,
) -> tuple[bool, str]:
    normalized_channel = (channel_key or "").strip() or "debug_log"
    if normalized_channel == "debug_log":
        logger.info(
            "debug_log channel push | title=%s | subject=%s | body=%s",
            payload.get("title", ""),
            payload.get("subject", ""),
            payload.get("body", ""),
        )
        return True, ""
    if normalized_channel == "test_db":
        row = TestPusherDelivery(
            user_id=user_id,
            rule_id=rule_id,
            notification_item_id=notification_item_id,
            title=str(payload.get("title") or ""),
            subject=str(payload.get("subject") or ""),
            body=str(payload.get("body") or ""),
            source=str(payload.get("source") or ""),
            external_id=str(payload.get("external_id") or ""),
        )
        db.add(row)
        return True, ""
    return False, f"unsupported_channel:{normalized_channel}"
