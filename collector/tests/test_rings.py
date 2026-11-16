from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from nhlcollector.ocr import TesseractReader
from nhlcollector.rings import NAMED_HUES, find_rings, hue_band, resolve_colors, tag_name
from nhlcollector.vision import Region


def ice_with_ring() -> Image.Image:
    img = Image.new("RGB", (640, 360), (235, 238, 242))
    d = ImageDraw.Draw(img)
    d.line((0, 200, 640, 210), fill=(220, 30, 30), width=6)        # red line across the ice
    d.ellipse((280, 170, 330, 190), outline=(40, 200, 60), width=3)  # green ring under a skater
    return img


def test_finds_ring_and_points_under_it_ignoring_lines():
    spots = find_rings(ice_with_ring(), {"green": NAMED_HUES["green"], "red": NAMED_HUES["red"]})
    assert set(spots) == {"green"}
    x, y, w, h = spots["green"]
    assert x < 280 / 640 < 330 / 640 < x + w      # tag spans the ring horizontally
    assert 190 / 360 <= y < 200 / 360               # and starts just below it


def test_hue_band_named_and_hex():
    assert hue_band("Green") == NAMED_HUES["green"]
    (lo, hi), = hue_band("#22cc44")
    assert lo < 90 < hi
    with pytest.raises(ValueError):
        hue_band("plaid")


def test_tag_name_and_resolve_colors():
    assert tag_name("Dx DISPOSABLE") == "DISPOSABLE"
    assert tag_name("Be") is None
    users = [{"userId": 10, "name": "Michal"}, {"userId": 11, "name": "Peter"}]
    colors, warnings = resolve_colors({"Michal": "green", "peter": "#3366ff", "Jano": "red", "Michal ": "plaid"}, users)
    assert colors == {10: "green", 11: "#3366ff"}
    assert len(warnings) == 2


reader = TesseractReader()


@pytest.mark.skipif(not reader.available, reason="Tesseract nie je nainštalovaný")
def test_real_frame_green_and_cyan_rings_with_names():
    img = Image.open(Path(__file__).parent / "fixtures" / "ea_rings.jpg").convert("RGB")
    spots = find_rings(img, {c: NAMED_HUES[c] for c in ("green", "cyan")})
    names = {c: tag_name(reader.read(img, Region("t", "", *box), "tag")) for c, box in spots.items()}
    assert names == {"green": "DISPOSABLE", "cyan": "SANDERSON"}
