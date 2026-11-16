"""
Reading text from the scoreboard and banners. Tesseract does the OCR (optional: install it with
`brew install tesseract`, `apt install tesseract-ocr` or the Windows installer, plus
`pip install -e ".[ocr]"`). The parsers below are pure functions so they can be tested and tuned
on screenshots from the actual game.
"""
from __future__ import annotations

import logging
import re
import unicodedata

log = logging.getLogger(__name__)

_CLOCK_RE = re.compile(r"(\d{1,2})\s*[:.;]\s*(\d{2})")


def parse_clock(text: str | None) -> str | None:
    """'12:34', '12.34', ' 0:45 ' → 'MM:SS'. Returns None when it isn't a plausible period clock."""
    if not text:
        return None
    cleaned = text.replace("O", "0").replace("o", "0").replace("l", "1").replace("I", "1")
    m = _CLOCK_RE.search(cleaned)
    if not m:
        digits = re.sub(r"\D", "", cleaned)
        if len(digits) in (3, 4):  # colon not read: '1234' → 12:34
            m = re.match(r"(\d{1,2})(\d{2})$", digits)
    if not m:
        return None
    minutes, seconds = int(m.group(1)), int(m.group(2))
    if minutes > 20 or seconds > 59:
        return None
    return f"{minutes:02d}:{seconds:02d}"


def parse_period(text: str | None) -> str | None:
    """'1st' → 'P1', '2ND' → 'P2', '3rd' → 'P3', 'OT' → 'OT', 'SO'/'Shootout' → 'SO', 'Final' → 'FINAL'."""
    if not text:
        return None
    t = re.sub(r"[^A-Z0-9/]", "", fold(text).upper())
    if not t:
        return None
    if t.startswith("FIN"):
        return "FINAL"
    if "SO" in t or "SHOOT" in t:
        return "SO"
    if "OT" in t or t.startswith("0T"):
        return "OT"
    m = re.search(r"([123])(ST|ND|RD)?", t) or re.search(r"P([123])", t)
    if m:
        return f"P{m.group(1)}"
    for word, p in (("FIRST", "P1"), ("SECOND", "P2"), ("THIRD", "P3")):
        if word in t:
            return p
    return None


def fold(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


GOAL_WORDS = ("GOAL", "SCORES", "SCORED", "GÓL")
MISS_WORDS = ("SAVE", "SAVED", "MISS", "MISSED", "STOPPED", "NO GOAL", "POST")


def banner_outcome(text: str | None) -> str | None:
    """'goal' / 'miss' / None from a banner's text (used in the shootout)."""
    if not text:
        return None
    t = fold(text).upper()
    if any(w in t for w in MISS_WORDS):
        return "miss"
    if any(w in t for w in GOAL_WORDS):
        return "goal"
    return None


def find_players(text: str | None, roster: list[dict]) -> list[dict]:
    """Roster players whose surname appears in the text, in reading order (scorer first, then assists)."""
    if not text:
        return []
    t = fold(text).upper()
    hits = []
    for p in roster:
        surname = fold(p["surname"]).upper()
        if len(surname) < 3:
            continue
        i = t.find(surname)
        if i < 0 and len(surname) >= 6:
            # tolerate one wrong letter in long names: compare on a sliding window
            i = _fuzzy_find(t, surname)
        if i >= 0:
            hits.append((i, p))
    hits.sort(key=lambda h: h[0])
    seen, ordered = set(), []
    for _, p in hits:
        if p["rosterPlayerId"] not in seen:
            seen.add(p["rosterPlayerId"])
            ordered.append(p)
    return ordered


def _fuzzy_find(text: str, word: str) -> int:
    n = len(word)
    for i in range(0, max(len(text) - n + 1, 0)):
        if sum(a != b for a, b in zip(text[i:i + n], word)) <= 1:
            return i
    return -1


def user_for_player(player: dict, users: list[dict]) -> dict | None:
    """The only user playing this player's position (C → C user, D → LD/RD user), else None."""
    positions = {x.strip().upper() for x in (player.get("position") or "").split(",") if x.strip()}
    if not positions:
        return None

    def matches(u: dict) -> bool:
        pos = (u.get("position") or "").upper()
        return pos in positions or (pos in ("LD", "RD") and "D" in positions)

    candidates = [u for u in users if matches(u)]
    return candidates[0] if len(candidates) == 1 else None


class TesseractReader:
    """Crops a region, cleans it up and runs Tesseract on it. `available` is False without Tesseract."""

    def __init__(self):
        self.available = False
        self.error: str | None = None
        try:
            import pytesseract

            pytesseract.get_tesseract_version()
            self._tess = pytesseract
            self.available = True
        except Exception as exc:  # noqa: BLE001 - missing module or binary
            self.error = "Tesseract nie je nainštalovaný" if "not installed" in str(exc) or isinstance(exc, ImportError) else str(exc)

    def read(self, image, region, mode: str) -> str | None:
        """Text in a region. Modes: 'clock', 'period', 'line' (one line of text), 'tag' (name tag on the ice), 'text' (banners), 'score'."""
        if not self.available:
            return None
        w, h = image.size
        crop = image.crop((int(region.x * w), int(region.y * h),
                           int((region.x + region.w) * w), int((region.y + region.h) * h)))
        try:
            if mode == "score":
                return self._score(crop)
            if mode == "text":
                return self._tess.image_to_string(clean_crop(crop), config="--psm 6").strip()
            if mode == "tag":  # small name tag under a player's ring
                return self._tess.image_to_string(tight(clean_crop(crop, scale=2)), config="--psm 7").strip()
            # Clock and period: one short line. Tesseract reads it best at the original size,
            # cropped tight (measured on EA NHL screenshots; 3x read '5:42' as '9:42').
            config = {"clock": "--psm 7 -c tessedit_char_whitelist=0123456789:",
                      "period": "--psm 7", "line": "--psm 7"}[mode]
            return self._tess.image_to_string(tight(clean_crop(crop, scale=1)), config=config).strip()
        except Exception as exc:  # noqa: BLE001
            log.warning("OCR failed: %s", exc)
            return None

    def _score(self, crop) -> str | None:
        """
        Both scores. A region taller than wide is a stacked scoreboard (one team per row, as in
        EA NHL): each half is read on its own, because the rows can have opposite colours.
        Otherwise the two numbers sit side by side.
        """
        if crop.height >= crop.width * 0.9:
            half = crop.height // 2
            rows = [self._digits(crop.crop((0, 0, crop.width, half))),
                    self._digits(crop.crop((0, half, crop.width, crop.height)))]
            return " ".join(rows) if all(rows) else None
        return self._tess.image_to_string(
            clean_crop(crop), config="--psm 7 -c tessedit_char_whitelist=0123456789-: ").strip()

    def _digits(self, crop) -> str:
        """
        One score number. Scoreboard fonts are wide and heavy, which Tesseract reads badly as they
        are: squeezing them horizontally helps. A few variants vote; the most common answer wins.
        """
        from collections import Counter

        from PIL import ImageOps

        clean = clean_crop(crop, scale=2)
        box = ImageOps.invert(clean).getbbox()
        if not box:
            return ""
        glyphs = clean.crop(box)
        votes: Counter[str] = Counter()
        for squeeze, psm in ((0.5, 13), (0.5, 7), (0.4, 13), (0.6, 13), (0.75, 13)):
            img = glyphs.resize((max(1, int(glyphs.width * squeeze)), glyphs.height))
            img = ImageOps.expand(img, border=20, fill=255)
            text = self._tess.image_to_string(
                img, config=f"--psm {psm} -c tessedit_char_whitelist=0123456789").strip()
            if text.isdigit() and len(text) <= 2:
                votes[text] += 1
                if votes[text] >= 2:
                    break  # two variants agree: good enough, saves Tesseract runs
        return votes.most_common(1)[0][0] if votes else ""


def _otsu(gray) -> int:
    """Threshold that best separates the two colours of a crop (text and background)."""
    hist = gray.histogram()
    total = sum(hist)
    sum_all = sum(i * n for i, n in enumerate(hist))
    weight_bg = sum_bg = 0
    best, threshold = 0.0, 128
    for t in range(256):
        weight_bg += hist[t]
        if not weight_bg:
            continue
        weight_fg = total - weight_bg
        if not weight_fg:
            break
        sum_bg += t * hist[t]
        mean_bg, mean_fg = sum_bg / weight_bg, (sum_all - sum_bg) / weight_fg
        between = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
        if between > best:
            best, threshold = between, t
    return threshold


def clean_crop(crop, scale: int = 3):
    """
    Black text on white, which is what Tesseract wants: enlarge, split the two colours, make the
    rarer colour (the text) black, and wipe everything touching the edge of the crop (separator
    lines, logos, half-visible neighbouring text).
    """
    from PIL import Image, ImageDraw, ImageOps

    gray = ImageOps.grayscale(crop)
    gray = gray.resize((max(gray.width * scale, 1), max(gray.height * scale, 1)), Image.LANCZOS)
    t = _otsu(gray)
    bw = gray.point(lambda p: 255 if p > t else 0)
    pixels = bw.tobytes()
    if pixels.count(0) > len(pixels) / 2:
        bw = ImageOps.invert(bw)
    w, h = bw.size
    edge = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    for xy in edge:
        if bw.getpixel(xy) == 0:
            ImageDraw.floodfill(bw, xy, 255)
    return ImageOps.expand(bw, border=15, fill=255)


def tight(clean, border: int = 10):
    """A cleaned crop cut down to its text, with a white margin."""
    from PIL import ImageOps

    box = ImageOps.invert(clean).getbbox()
    return ImageOps.expand(clean.crop(box), border=border, fill=255) if box else clean


# ─── banners ───────────────────────────────────────────────────────────────

_GOAL_LINE = re.compile(r"\bG[O0]AL\b|\bG[O0]AL[\[(|]|SCORES|GÓL", re.I)
_ASSIST_LINE = re.compile(r"ASS[I1l]ST", re.I)
_PENALTY_LINE = re.compile(r"PENALTY|MINOR|MAJOR|TRIPPING|HOOKING|SLASHING|ROUGHING|INTERFERENCE|HOLDING", re.I)
_UNASSISTED = re.compile(r"UNASSISTED", re.I)


def parse_banner(text: str | None) -> dict | None:
    """
    Kind and names from a banner, e.g. EA NHL's two-line banners:
      'PIŤŤŠY / GOAL[1]'        → {'type': 'goal', 'names': ['PIŤŤŠY']}
      'WZRD, GOGUEN / ASSISTS'  → {'type': 'assists', 'names': ['WZRD', 'GOGUEN']}
    Names are the other lines, split on commas. None when the banner isn't recognised.
    """
    if not text:
        return None
    lines = [ln.strip(" |[]{}()") for ln in text.splitlines() if ln.strip(" |[]{}()")]
    kind, keyword_line = None, None
    for i, ln in enumerate(lines):
        if _UNASSISTED.search(ln):
            return {"type": "assists", "names": []}
        if _GOAL_LINE.search(fold(ln)) or _GOAL_LINE.search(ln):
            kind, keyword_line = "goal", i  # 'GOAL X Assist: Y' on one line is a goal banner
        elif _ASSIST_LINE.search(ln):
            kind, keyword_line = "assists", i
        elif _PENALTY_LINE.search(ln):
            kind, keyword_line = "penalty", i
        if kind:
            break
    if not kind:
        return None
    names: list[str] = []
    for i, ln in enumerate(lines):
        if i == keyword_line:
            ln = re.sub(r"G[O0]AL\s*(?:[\[(|{]\s*\w{1,2}\s*[\])|}]?|\w{1,2}\s*[\])|}])", "GOAL", ln, flags=re.I)  # 'GOAL[1]'
            # 'GOAL MACKINNON Assist: MAKAR' on one line: keep what follows the keyword
            ln = ",".join(re.split(r"G[O0]AL\S*|ASS[I1l]STS?:?|SCORES", ln, flags=re.I))
        for part in re.split(r"[,;/]", ln):
            part = re.sub(r"[^\w' .-]", "", part).strip(" .-'")
            if len(part) >= 3 and not part.isdigit():  # shorter bits are OCR noise ('GOAL[1]' read as 'IT')
                names.append(part)
    return {"type": kind, "names": names}


_CONTROLLED_RE = re.compile(r"(\d{1,2})\s+([A-Z])\s*[.,]?\s*([A-Z][A-Z'\- ]+[A-Z])", re.I)


def parse_controlled(text: str | None) -> dict | None:
    """
    The controlled-player box, EA NHL bottom left: '33 H. DISPOSABLE' → {'number': 33,
    'initial': 'H', 'surname': 'DISPOSABLE'}. None when no number + name is there.
    """
    if not text:
        return None
    m = _CONTROLLED_RE.search(fold(text))
    if not m:
        return None
    return {"number": int(m.group(1)), "initial": m.group(2).upper(), "surname": m.group(3).strip().upper()}


def find_controlled(c: dict, roster: list[dict]) -> dict | None:
    """The roster player for a controlled-player reading: surname, with the initial deciding between namesakes."""
    players = [p for p in find_players(c["surname"], roster) if _key(p["surname"]) == _key(c["surname"])] \
        or find_players(c["surname"], roster)
    if len(players) > 1:
        players = [p for p in players if fold(p["firstName"])[:1].upper() == c["initial"]] or players
    return players[0] if players else None


def _key(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", fold(name).upper())


def _edits(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def match_alias(name: str, aliases: list[dict]) -> dict | None:
    """
    The alias entry for an in-game name. OCR drops or confuses a letter now and then, so names
    of 5+ characters may differ by one edit ('PITTS' finds 'PIŤŤŠY'), longer ones by two.
    """
    key = _key(name)
    if len(key) < 2:
        return None
    best, best_d = None, 99
    for a in aliases:
        for alias in a["names"]:
            ak = _key(alias)
            d = _edits(key, ak)
            allowed = 0 if len(ak) < 5 else 1 if len(ak) < 9 else 2
            if d <= allowed and d < best_d:
                best, best_d = a, d
    return best


def resolve_aliases(raw: dict, users: list[dict], roster: list[dict]) -> tuple[list[dict], list[str]]:
    """
    Turns the [aliases] config section into entries with ids:
      "PIŤŤŠY" = "Michal"                               → that user
      "WZRD"   = { user = "Peter", player = "Makar" }   → that user and roster player
    Users are matched by name (or id), players by surname. Returns (entries, warnings).
    """
    entries: list[dict] = []
    warnings: list[str] = []
    for alias, target in (raw or {}).items():
        spec = target if isinstance(target, dict) else {"user": target}
        user_q, player_q = spec.get("user"), spec.get("player")
        user = None
        if user_q is not None:
            q = _key(str(user_q))
            user = next((u for u in users if str(u["userId"]) == str(user_q) or _key(u["name"]) == q), None) \
                or next((u for u in users if q and q in _key(u["name"])), None)
            if not user:
                warnings.append(f"Alias '{alias}': používateľ '{user_q}' nie je v sezóne.")
                continue
        player = None
        if player_q:
            q = _key(str(player_q))
            player = next((p for p in roster if str(p["rosterPlayerId"]) == str(player_q) or _key(p["surname"]) == q), None)
            if not player:
                warnings.append(f"Alias '{alias}': hráč '{player_q}' nie je na súpiske.")
        names = [alias] + [n for n in spec.get("names", []) if isinstance(n, str)]
        entries.append({"names": names, "userId": user["userId"] if user else None,
                        "rosterPlayerId": player["rosterPlayerId"] if player else None,
                        "label": user["name"] if user else alias})
    return entries, warnings


_SCORE_RE = re.compile(r"(\d{1,2})\D+(\d{1,2})")


def parse_score(text: str | None) -> tuple[int, int] | None:
    """'2 1', '2-1', '2 : 1' → (2, 1): first (left or top) number first, as the scoreboard shows them."""
    if not text:
        return None
    m = _SCORE_RE.search(text.replace("O", "0").replace("o", "0"))
    if not m:
        digits = re.sub(r"\D", "", text)
        return (int(digits[0]), int(digits[1])) if len(digits) == 2 else None
    a, b = int(m.group(1)), int(m.group(2))
    return (a, b) if a < 30 and b < 30 else None
