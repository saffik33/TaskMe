"""Tests for normalize_priority utility used in breakdown and scanner."""

from app.routers.agents import _normalize_priority
from app.routers.agent_ws import _normalize_priority as ws_normalize_priority


class TestNormalizePriority:
    """Test _normalize_priority from agents.py."""

    def test_high(self):
        assert _normalize_priority("High") == "High"

    def test_uppercase(self):
        assert _normalize_priority("HIGH") == "High"

    def test_enum_format(self):
        assert _normalize_priority("TaskPriority.CRITICAL") == "Critical"

    def test_lowercase(self):
        assert _normalize_priority("low") == "Low"

    def test_unknown_uses_fallback(self):
        assert _normalize_priority("urgent") == "Medium"

    def test_none_uses_fallback(self):
        assert _normalize_priority(None) == "Medium"

    def test_custom_fallback(self):
        assert _normalize_priority(None, "High") == "High"

    def test_critical(self):
        assert _normalize_priority("critical") == "Critical"


class TestWsNormalizePriority:
    """Test _normalize_priority from agent_ws.py (same logic, separate copy)."""

    def test_high(self):
        assert ws_normalize_priority("High") == "High"

    def test_enum_format(self):
        assert ws_normalize_priority("TaskPriority.HIGH") == "High"

    def test_none(self):
        assert ws_normalize_priority(None) == "Medium"
