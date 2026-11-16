"""
Real Tesseract on crops of EA NHL screenshots (top-left 30 % x 12 % of a 1838x1028 frame).
Skipped when Tesseract isn't installed.
"""
from pathlib import Path

import pytest
from PIL import Image

from nhlcollector.ocr import TesseractReader, parse_banner, parse_clock, parse_period, parse_score
from nhlcollector.vision import DEFAULT_REGIONS, Region

FIXTURES = Path(__file__).parent / "fixtures"
reader = TesseractReader()
pytestmark = pytest.mark.skipif(not reader.available, reason="Tesseract nie je nainštalovaný")

# The fixtures are crops, so scale the default regions (fractions of the full frame) to them.
CROP_W, CROP_H = 0.3, 0.12
REGIONS = {r.name: Region(r.name, r.label, r.x / CROP_W, r.y / CROP_H, r.w / CROP_W, r.h / CROP_H)
           for r in DEFAULT_REGIONS}


def read(name, region, mode):
    return reader.read(Image.open(FIXTURES / f"{name}.png").convert("RGB"), REGIONS[region], mode)


@pytest.mark.parametrize("name, score, clock, period", [
    ("ea_scoreboard", (2, 3), "15:16", "P2"),
    ("ea_scoreboard_ot", (6, 6), "15:21", "OT"),
])
def test_scoreboard(name, score, clock, period):
    assert parse_score(read(name, "score", "score")) == score
    assert parse_clock(read(name, "clock", "clock")) == clock
    assert parse_period(read(name, "period", "period")) == period


def test_goal_banner_keeps_clock_and_period_visible():
    banner = parse_banner(read("ea_goal_banner", "banner", "text"))
    assert banner["type"] == "goal" and banner["names"][0].startswith("PI")
    assert parse_clock(read("ea_goal_banner", "clock", "clock")) == "16:25"
    assert parse_period(read("ea_goal_banner", "period", "period")) == "P1"
    assert parse_score(read("ea_goal_banner", "score", "score")) is None  # score hidden by the banner


def test_assists_banner():
    assert parse_banner(read("ea_assists_banner", "banner", "text")) == {"type": "assists", "names": ["WZRD", "GOGUEN"]}
    assert parse_clock(read("ea_assists_banner", "clock", "clock")) == "05:42"
