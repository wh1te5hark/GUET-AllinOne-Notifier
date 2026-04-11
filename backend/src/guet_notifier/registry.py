"""Static catalogs for UI: collectors (notification sources) and pushers (channels)."""

from typing import TypedDict


class CatalogEntry(TypedDict):
    key: str
    label_zh: str
    label_en: str


# Synthetic messages use this as NotificationItem.source (and forwarding collector_key).
TEST_COLLECTOR_SOURCE = "test_collector"

# Keys must match NotificationItem.source / collector_key used when syncing.
COLLECTORS: list[CatalogEntry] = [
    {"key": "smart_campus", "label_zh": "智慧校园", "label_en": "Smart Campus"},
    {
        "key": TEST_COLLECTOR_SOURCE,
        "label_zh": "测试采集器（联调）",
        "label_en": "Test collector (integration)",
    },
]

# Keys must match pushers.send branch names and rule config channel_keys.
PUSHERS: list[CatalogEntry] = [
    {"key": "debug_log", "label_zh": "调试日志（服务端日志）", "label_en": "Debug log (server)"},
    {"key": "test_db", "label_zh": "测试推送（写入数据库，规则页可见）", "label_en": "Test DB (stored, visible on Rules page)"},
]


def list_collectors() -> list[CatalogEntry]:
    return list(COLLECTORS)


def list_pushers() -> list[CatalogEntry]:
    return list(PUSHERS)


def is_known_pusher_key(key: str) -> bool:
    k = (key or "").strip()
    return any(p["key"] == k for p in PUSHERS)
