from __future__ import annotations

import argparse
import sys
import threading
from pathlib import Path

import httpx

from .api import ApiError, NhlStatsClient
from .config import load_config
from .obs import ObsBridge
from .outbox import Outbox
from .session import CommandError, MatchSession

HELP = """
Príkazy (Enter potvrdí). Čas z obrazovky môžeš pridať ako @12:34 kamkoľvek.
  g 2 mack        náš gól: používateľ č. 2, hráč podľa časti mena   (g 2 mack pp / sh)
  g               náš gól, strelca doplníš pri potvrdení
  o               gól súpera                                         (o pp / o sh)
  p 3 kadri       náš trest
  po              trest súpera
  so 1 rantanen   gól v nájazdoch (soo = nájazd súpera)
  n               ďalšia perióda (P1 → P2 → P3 → OT)
  end | end ot | end so    koniec zápasu
  x               zrušiť poslednú ešte neodoslanú udalosť
  s               stav: odoslané, čakajúce, potvrdené
  u               zoznam používateľov a súpiska
  h               pomoc,   q   koniec
"""


def _print_users(ctx: dict) -> None:
    print("\nPoužívatelia:")
    for i, u in enumerate(ctx["users"], 1):
        print(f"  {i}. {u['name']}" + (f"  [{u['position']}]" if u.get("position") else ""))
    print(f"Súpiska: {len(ctx['roster'])} hráčov, napr. "
          + ", ".join(p["surname"] for p in ctx["roster"][:8]) + (" …" if len(ctx["roster"]) > 8 else ""))


def _choose_match(client: NhlStatsClient, match_id: int | None) -> int:
    if match_id:
        return match_id
    matches = client.open_matches()
    if not matches:
        sys.exit("Žiadny otvorený zápas v aktívnej sezóne. Vytvor ho v NHLStats alebo zadaj --match.")
    print("Otvorené zápasy:")
    for i, m in enumerate(matches, 1):
        print(f"  {i}. #{m['matchNumber']} {m['homeTeamShortName']} – {m['awayTeamShortName']}"
              f"  ({m['seasonName']}, {m['homeScore']}:{m['awayScore']}, {m['completionType']})")
    while True:
        choice = input("Vyber zápas (číslo): ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(matches):
            return matches[int(choice) - 1]["id"]


def _status(client: NhlStatsClient, outbox: Outbox, match_id: int) -> None:
    items = outbox.items
    failed = [i for i in items if i["error"]]
    print(f"Lokálne: {len(items)} udalostí, čaká na odoslanie {outbox.pending_count}, odmietnuté pri odoslaní {len(failed)}")
    for i in failed:
        print(f"  ! {i['event']['eventType']}: {i['error']}")
    try:
        proposals = client.proposals(match_id)
    except (httpx.HTTPError, ApiError) as exc:
        print(f"Server nedostupný: {exc}")
        return
    counts: dict[str, int] = {}
    for p in proposals:
        counts[p["status"]] = counts.get(p["status"], 0) + 1
    print("Na serveri: " + (", ".join(f"{k} {v}" for k, v in counts.items()) or "nič"))


def run(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="nhlcollector", description="Zápis udalostí zápasu do NHLStats.")
    parser.add_argument("--config", type=Path, default=Path("config.toml"))
    parser.add_argument("--match", type=int, help="Id zápasu (inak sa vyberie zo zoznamu)")
    args = parser.parse_args(argv)

    cfg = load_config(args.config)
    try:
        client = NhlStatsClient(cfg.api.url, cfg.api.key)
        who = client.whoami()
    except ValueError as exc:
        sys.exit(str(exc))
    except ApiError as exc:
        sys.exit(f"API kľúč nefunguje ({exc}). Skontroluj ho v NHLStats.")
    except httpx.HTTPError as exc:
        sys.exit(f"Server {cfg.api.url} nie je dostupný: {exc}")
    print(f"Pripojené k {cfg.api.url} ako '{who['name']}'.")

    match_id = _choose_match(client, args.match)
    ctx = client.context(match_id)
    m = ctx["match"]
    print(f"\nZápas #{m['matchNumber']} {m['homeTeamShortName']} – {m['awayTeamShortName']}"
          f" ({'doma' if ctx['hostedIsHome'] else 'vonku'})")
    _print_users(ctx)

    obs = ObsBridge(cfg.obs, cfg.data_dir / f"match-{match_id}")
    if obs.connect():
        print("OBS pripojené: pri každej udalosti sa uloží screenshot a Replay Buffer.")
    else:
        print(f"OBS nepripojené ({obs.error}), udalosti sa zapisujú bez obrazu.")

    outbox = Outbox(cfg.data_dir / f"match-{match_id}" / "outbox.json")
    session = MatchSession(match_id, ctx["users"], ctx["roster"])
    stop = threading.Event()

    def flush(verbose: bool = False) -> None:
        sent, error = outbox.flush(client, match_id)
        if error and verbose:
            print(f"  (neodoslané, skúsim znova: {error})")
        elif sent and verbose:
            print(f"  odoslané ({sent})")

    def background_flush() -> None:
        while not stop.wait(15):
            flush()

    threading.Thread(target=background_flush, daemon=True).start()
    flush(verbose=True)
    print(HELP)

    try:
        while True:
            try:
                line = input(f"[{session.period_label}] > ").strip()
            except EOFError:
                break
            cmd = line.split()[0].lower() if line else ""
            if cmd in ("q", "quit", "exit"):
                break
            if cmd in ("h", "?", "help"):
                print(HELP)
                continue
            if cmd == "u":
                _print_users(ctx)
                continue
            if cmd == "s":
                flush(verbose=True)
                _status(client, outbox, match_id)
                continue
            if cmd == "x":
                pending = [i for i in outbox.items if not i["sent"]]
                if pending and outbox.remove_unsent(pending[-1]["event"]["clientEventId"]):
                    print("  zrušené")
                else:
                    print("  nič na zrušenie (odoslané udalosti zamietni v NHLStats)")
                continue
            try:
                event = session.parse(line)
            except CommandError as exc:
                print(f"  {exc}")
                continue
            if event is None:
                continue
            display = event.pop("_display", None)
            event["mediaRef"] = obs.capture(event["eventType"].lower())
            outbox.add(event)
            print(f"  ✓ {event['eventType']}" + (" súpera" if event["isOpponent"] else "")
                  + (f" – {display}" if display else "")
                  + (f" ({event['eventSubtype']})" if event.get("eventSubtype") else ""))
            flush(verbose=True)
    finally:
        stop.set()
        flush(verbose=True)
        if outbox.pending_count:
            print(f"Pozor: {outbox.pending_count} udalostí ešte nie je odoslaných. "
                  "Odošlú sa pri ďalšom spustení pre tento zápas.")
        client.close()


def main() -> None:
    try:
        run()
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
