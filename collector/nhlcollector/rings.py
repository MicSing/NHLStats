"""
Coloured player indicators. In NHL each human player has a coloured ring under their skater and a
name tag below it ('X MACKINNON'). The ring colour tells which user it is, the tag which hockey
player that user is skating with right now. This finds the ring of each configured colour; the
tag under it is then read by OCR.
"""
from __future__ import annotations

# Hue bands on Pillow's 0–255 HSV scale, measured on EA NHL rings.
NAMED_HUES: dict[str, tuple[tuple[int, int], ...]] = {
    "red": ((245, 256), (0, 8)),
    "orange": ((10, 28),),
    "yellow": ((30, 50),),
    "green": ((60, 105),),
    "cyan": ((110, 135),),
    "blue": ((135, 175),),
    "pink": ((225, 245),),
}

WORK_WIDTH = 919  # rings are searched on a half-size copy of a 1080p frame


def hue_band(color: str) -> tuple[tuple[int, int], ...]:
    """'green' or '#22cc44' → hue ranges. Raises ValueError for anything else."""
    c = color.strip().lower()
    if c in NAMED_HUES:
        return NAMED_HUES[c]
    if c.startswith("#") and len(c) == 7:
        import colorsys

        r, g, b = (int(c[i:i + 2], 16) / 255 for i in (1, 3, 5))
        h = int(colorsys.rgb_to_hsv(r, g, b)[0] * 255)
        lo, hi = h - 12, h + 12
        if lo < 0:
            return ((0, hi), (256 + lo, 256))
        if hi > 256:
            return ((lo, 256), (0, hi - 256))
        return ((lo, hi),)
    raise ValueError(f"neznáma farba '{color}' (použi {', '.join(NAMED_HUES)} alebo #rrggbb)")


def _components(mask) -> list[tuple[int, int, int, int, int]]:
    """Bounding boxes (x0, y0, x1, y1, pixel count) of the white blobs in a mask."""
    w, _ = mask.size
    data = bytearray(mask.tobytes())
    out = []
    for i, val in enumerate(data):
        if not val:
            continue
        stack, data[i] = [i], 0
        x0 = y0 = 10 ** 9
        x1 = y1 = n = 0
        while stack:
            j = stack.pop()
            x, y = j % w, j // w
            x0, y0, x1, y1, n = min(x0, x), min(y0, y), max(x1, x), max(y1, y), n + 1
            for k in (j - 1, j + 1, j - w, j + w):
                if 0 <= k < len(data) and data[k] and abs(k % w - x) <= 1:
                    data[k] = 0
                    stack.append(k)
        out.append((x0, y0, x1, y1, n))
    return out


def find_rings(image, colors: dict[str, tuple[tuple[int, int], ...]]) -> dict[str, tuple[float, float, float, float]]:
    """
    For each colour, where its name tag probably is, as (x, y, w, h) fractions of the frame:
    just under the most ring-like blob of that colour (an ellipse about 2–4x wider than tall,
    hollow). Lines on the ice and the HUD at the top and bottom are ignored.
    """
    from PIL import ImageChops, ImageFilter

    W, H = image.size
    scale = W / WORK_WIDTH
    small = image.convert("RGB").resize((WORK_WIDTH, max(int(H / scale), 1)))
    sw, sh = small.size
    hue, sat, val = small.convert("HSV").split()
    vivid = ImageChops.multiply(sat.point(lambda p: 255 if p > 45 else 0),
                                val.point(lambda p: 255 if p > 90 else 0))
    found = {}
    for name, ranges in colors.items():
        band = None
        for lo, hi in ranges:
            part = hue.point(lambda p, lo=lo, hi=hi: 255 if lo <= p < hi else 0)
            band = part if band is None else ImageChops.lighter(band, part)
        mask = ImageChops.multiply(band, vivid).filter(ImageFilter.MaxFilter(5))  # close dashed rings
        best = None
        for x0, y0, x1, y1, n in _components(mask):
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            if not (25 <= bw <= 90 and 10 <= bh <= 40 and 1.6 <= bw / bh <= 4.5 and n / (bw * bh) < 0.75):
                continue
            if y0 < sh * 0.10 or y1 > sh * 0.90:
                continue  # scoreboard / controlled-player box
            if best is None or n > best[4]:
                best = (x0, y0, x1, y1, n)
        if best:
            x0, _, x1, y1, _ = best
            cx = (x0 + x1) / 2
            left, top = max(cx - 65, 0), y1 + 1
            right, bottom = min(cx + 75, sw), min(y1 + 22, sh)
            found[name] = (left / sw, top / sh, (right - left) / sw, (bottom - top) / sh)
    return found


def tag_name(text: str | None) -> str | None:
    """'DX DISPOSABLE' / 'X MACKINNON' → the name: the longest word of 3+ letters."""
    if not text:
        return None
    import re

    words = [w for w in re.findall(r"[^\W\d_]{3,}", text) if w.upper() not in ("DX",)]
    return max(words, key=len) if words else None


def resolve_colors(raw: dict, users: list[dict]) -> tuple[dict[int, str], list[str]]:
    """The [colors] config section ("Michal" = "green") → {userId: colour}, plus warnings."""
    out: dict[int, str] = {}
    warnings: list[str] = []
    for who, color in (raw or {}).items():
        q = str(who).strip().lower()
        user = next((u for u in users if u["name"].lower() == q or str(u["userId"]) == q), None) \
            or next((u for u in users if q and q in u["name"].lower()), None)
        if not user:
            warnings.append(f"Farba pre '{who}': používateľ nie je v sezóne.")
            continue
        try:
            hue_band(str(color))
        except ValueError as exc:
            warnings.append(f"Farba pre '{who}': {exc}")
            continue
        out[user["userId"]] = str(color)
    return out, warnings
