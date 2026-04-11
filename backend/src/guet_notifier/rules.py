import re
from dataclasses import dataclass


@dataclass
class RuleMatchResult:
    matched: bool
    reason: str = ""


def _normalize_keywords(values: list[str] | None) -> list[str]:
    if not values:
        return []
    return [str(v).strip() for v in values if str(v).strip()]


def _build_search_text(notification: dict) -> str:
    fields = [
        str(notification.get("title") or ""),
        str(notification.get("sender") or ""),
        str(notification.get("content_text") or ""),
        str(notification.get("content_html") or ""),
        str(notification.get("occurred_at_text") or ""),
        str(notification.get("source") or ""),
    ]
    return "\n".join(fields)


def _keyword_hit(text: str, keyword: str, use_regex: bool) -> bool:
    if use_regex:
        try:
            return re.search(keyword, text, flags=re.IGNORECASE) is not None
        except re.error:
            return False
    return keyword.lower() in text.lower()


def match_notification(rule_config: dict, notification: dict) -> RuleMatchResult:
    sources = [str(s).strip() for s in (rule_config.get("sources") or []) if str(s).strip()]
    source = str(notification.get("source") or "")
    if sources and source not in sources:
        return RuleMatchResult(False, "source_not_matched")

    match_cfg = rule_config.get("match") or {}
    include_any = _normalize_keywords(match_cfg.get("include_any"))
    exclude_any = _normalize_keywords(match_cfg.get("exclude_any"))
    use_regex = bool(match_cfg.get("use_regex"))
    mode = str(match_cfg.get("mode") or "all")

    search_text = _build_search_text(notification)

    for keyword in exclude_any:
        if _keyword_hit(search_text, keyword, use_regex):
            return RuleMatchResult(False, "excluded_by_keyword")

    if not include_any:
        return RuleMatchResult(True, "no_include_rules")

    hits = [_keyword_hit(search_text, keyword, use_regex) for keyword in include_any]
    if mode == "any":
        return RuleMatchResult(any(hits), "include_any_mode")
    return RuleMatchResult(all(hits), "include_all_mode")


def render_template(template: str, notification: dict) -> str:
    value = str(template or "")
    replacements = {
        "{{title}}": str(notification.get("title") or ""),
        "{{sender}}": str(notification.get("sender") or ""),
        "{{content_text}}": str(notification.get("content_text") or ""),
        "{{content_html}}": str(notification.get("content_html") or ""),
        "{{occurred_at_text}}": str(notification.get("occurred_at_text") or ""),
        "{{source}}": str(notification.get("source") or ""),
        "{{external_id}}": str(notification.get("external_id") or ""),
    }
    for key, replacement in replacements.items():
        value = value.replace(key, replacement)
    return value
