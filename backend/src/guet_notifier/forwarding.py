import json
import logging
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from guet_notifier.models import NotificationItem, PushAttempt, SubscriptionRule
from guet_notifier.pushers import send as send_pusher
from guet_notifier.rules import match_notification, render_template

logger = logging.getLogger("guet_notifier.forwarding")


def _notification_payload(item: NotificationItem) -> dict:
    return {
        "source": item.source,
        "external_id": item.external_id,
        "title": item.title,
        "sender": item.sender,
        "content_text": item.content_text,
        "content_html": item.content_html,
        "occurred_at_text": item.occurred_at_text,
    }


def _load_rule_config_json(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _execute_rules_for_notification(
    db: Session,
    *,
    user_id: int,
    item: NotificationItem,
) -> tuple[int, int]:
    success_count = 0
    failed_count = 0
    rules = db.scalars(
        select(SubscriptionRule).where(
            SubscriptionRule.user_id == user_id,
            SubscriptionRule.enabled.is_(True),
        )
    ).all()
    if not rules:
        return success_count, failed_count

    notification = _notification_payload(item)
    for rule in rules:
        config = _load_rule_config_json(rule.rule_config_json or rule.rule_config)
        match_result = match_notification(config, notification)
        if not match_result.matched:
            continue

        template = config.get("template") or {}
        subject = render_template(str(template.get("subject") or "{{title}}"), notification)
        body = render_template(str(template.get("body") or "{{content_text}}"), notification)
        channel_keys = [str(k).strip() for k in (config.get("channel_keys") or ["debug_log"]) if str(k).strip()]
        if not channel_keys:
            channel_keys = ["debug_log"]

        for channel_key in channel_keys:
            existing_success = db.scalar(
                select(PushAttempt).where(
                    PushAttempt.user_id == user_id,
                    PushAttempt.notification_item_id == item.id,
                    PushAttempt.rule_id == rule.id,
                    PushAttempt.channel_key == channel_key,
                    PushAttempt.status == "success",
                )
            )
            if existing_success is not None:
                continue
            ok, error_message = send_pusher(
                db,
                user_id=user_id,
                rule_id=rule.id,
                notification_item_id=item.id,
                channel_key=channel_key,
                payload={
                    "title": item.title,
                    "subject": subject,
                    "body": body,
                    "source": item.source,
                    "external_id": item.external_id,
                },
            )
            db.add(
                PushAttempt(
                    user_id=user_id,
                    notification_item_id=item.id,
                    rule_id=rule.id,
                    channel_key=channel_key,
                    status="success" if ok else "failed",
                    error_message=error_message or "",
                )
            )
            if ok:
                success_count += 1
            else:
                failed_count += 1
    return success_count, failed_count


def forward_notifications_for_user(
    db: Session,
    *,
    user_id: int,
    collector_key: str,
    items: Sequence[NotificationItem],
) -> tuple[int, int]:
    """
    Collector-agnostic forwarding entry point.
    Any collector can call this after notifications are persisted.
    """
    total_success = 0
    total_failed = 0
    if not items:
        return total_success, total_failed
    for item in items:
        success_count, failed_count = _execute_rules_for_notification(
            db,
            user_id=user_id,
            item=item,
        )
        total_success += success_count
        total_failed += failed_count
    logger.info(
        "Forwarding executed | user_id=%s collector=%s items=%s success=%s failed=%s",
        user_id,
        collector_key,
        len(items),
        total_success,
        total_failed,
    )
    return total_success, total_failed
