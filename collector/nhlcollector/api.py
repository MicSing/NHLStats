from __future__ import annotations

from typing import Any

import httpx


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"HTTP {status}: {message}")
        self.status = status


class NhlStatsClient:
    """Thin client for the NHLStats ingest API (X-Api-Key authentication)."""

    def __init__(self, base_url: str, api_key: str, *, timeout: float = 10.0,
                 transport: httpx.BaseTransport | None = None):
        if not api_key:
            raise ValueError("API key is missing (config [api].key or NHLSTATS_API_KEY).")
        self._http = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"X-Api-Key": api_key, "User-Agent": "nhlcollector/0.1"},
            timeout=timeout,
            transport=transport,
        )

    def close(self) -> None:
        self._http.close()

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        resp = self._http.request(method, path, **kwargs)
        if resp.status_code >= 400:
            try:
                message = resp.json().get("error") or resp.text
            except ValueError:
                message = resp.text
            raise ApiError(resp.status_code, message or resp.reason_phrase)
        return resp.json() if resp.content else None

    def whoami(self) -> dict:
        return self._request("GET", "/api/ingest/whoami")

    def open_matches(self) -> list[dict]:
        return self._request("GET", "/api/ingest/matches")

    def context(self, match_id: int) -> dict:
        return self._request("GET", f"/api/ingest/matches/{match_id}/context")

    def submit_events(self, match_id: int, events: list[dict]) -> list[dict]:
        body = self._request("POST", f"/api/ingest/matches/{match_id}/events", json={"events": events})
        return body["results"]

    def proposals(self, match_id: int) -> list[dict]:
        return self._request("GET", f"/api/ingest/matches/{match_id}/events")
