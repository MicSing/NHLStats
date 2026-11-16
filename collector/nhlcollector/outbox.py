from __future__ import annotations

import json
import threading
from pathlib import Path

import httpx

from .api import ApiError, NhlStatsClient


class Outbox:
    """
    Durable queue of events for one match. Every event is written to disk before it is sent,
    so nothing is lost if the network or the API is down; sending is idempotent on the server
    (by clientEventId), so re-sending after a crash is safe.
    """

    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._items: list[dict] = []
        if path.exists():
            self._items = json.loads(path.read_text(encoding="utf-8"))

    def _save(self) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._items, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.path)

    def add(self, event: dict) -> None:
        with self._lock:
            self._items.append({"event": event, "sent": False, "proposalId": None, "error": None})
            self._save()

    def remove_unsent(self, client_event_id: str) -> bool:
        with self._lock:
            for i, item in enumerate(self._items):
                if item["event"]["clientEventId"] == client_event_id and not item["sent"]:
                    del self._items[i]
                    self._save()
                    return True
            return False

    @property
    def items(self) -> list[dict]:
        with self._lock:
            return [dict(i) for i in self._items]

    @property
    def pending_count(self) -> int:
        with self._lock:
            return sum(1 for i in self._items if not i["sent"] and not i["error"])

    def flush(self, client: NhlStatsClient, match_id: int) -> tuple[int, str | None]:
        """Sends unsent events. Returns (number sent, connection error or None)."""
        with self._lock:
            batch = [i["event"] for i in self._items if not i["sent"] and not i["error"]]
        if not batch:
            return 0, None
        try:
            results = client.submit_events(match_id, batch)
        except (httpx.HTTPError, ApiError) as exc:
            return 0, str(exc)

        by_id = {r["clientEventId"]: r for r in results}
        sent = 0
        with self._lock:
            for item in self._items:
                result = by_id.get(item["event"]["clientEventId"])
                if result is None or item["sent"]:
                    continue
                if result.get("error"):
                    # Rejected by validation: keep it visible, don't retry forever.
                    item["error"] = result["error"]
                else:
                    item["sent"] = True
                    item["proposalId"] = result.get("proposalId")
                    sent += 1
            self._save()
        return sent, None
