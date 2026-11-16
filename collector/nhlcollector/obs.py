from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from .config import ObsConfig

log = logging.getLogger(__name__)


class ObsBridge:
    """
    Talks to OBS over its built-in WebSocket server (OBS 28+): saves a screenshot of the
    program output and the Replay Buffer when an event is recorded. Later the same connection
    will feed frames to the automatic recognition. Every call is best-effort: OBS being
    closed must never stop events from being recorded.
    """

    def __init__(self, cfg: ObsConfig, media_dir: Path):
        self.cfg = cfg
        self.media_dir = media_dir.resolve()
        self._client = None
        self.error: str | None = None

    def connect(self) -> bool:
        if not self.cfg.enabled:
            self.error = "disabled in config"
            return False
        try:
            import obsws_python as obs  # imported lazily so the app runs without OBS installed

            self._client = obs.ReqClient(host=self.cfg.host, port=self.cfg.port,
                                         password=self.cfg.password or None, timeout=3)
            self.error = None
            return True
        except Exception as exc:  # noqa: BLE001 - any failure just disables OBS features
            self._client = None
            self.error = str(exc) or exc.__class__.__name__
            return False

    @property
    def connected(self) -> bool:
        return self._client is not None

    def capture(self, label: str) -> str | None:
        """Saves a screenshot (and the replay buffer) for an event; returns the screenshot file name."""
        if self._client is None:
            return None
        shot_name: str | None = None
        if self.cfg.screenshots:
            try:
                scene = self._client.get_current_program_scene()
                scene_name = getattr(scene, "current_program_scene_name", None) or getattr(scene, "scene_name")
                self.media_dir.mkdir(parents=True, exist_ok=True)
                shot_name = f"{datetime.now():%Y%m%d-%H%M%S}-{label}.png"
                self._client.save_source_screenshot(scene_name, "png", str(self.media_dir / shot_name), 1920, 1080, -1)
            except Exception as exc:  # noqa: BLE001
                log.warning("OBS screenshot failed: %s", exc)
                shot_name = None
        if self.cfg.replay_buffer:
            try:
                self._client.save_replay_buffer()
            except Exception as exc:  # noqa: BLE001
                log.info("OBS replay buffer not saved (is it running?): %s", exc)
        return shot_name
