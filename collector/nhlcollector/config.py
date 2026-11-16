from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ApiConfig:
    url: str = "http://localhost:5267"
    key: str = ""


@dataclass
class ObsConfig:
    enabled: bool = False
    host: str = "localhost"
    port: int = 4455
    password: str = ""
    screenshots: bool = True
    replay_buffer: bool = True


@dataclass
class VisionConfig:
    # The scoreboard lists the home team first (top row, or left). Set false if it shows the
    # away team first, so the app knows which team scored.
    home_first: bool = True


@dataclass
class Config:
    api: ApiConfig = field(default_factory=ApiConfig)
    obs: ObsConfig = field(default_factory=ObsConfig)
    vision: VisionConfig = field(default_factory=VisionConfig)
    # In-game names (gamertags) → NHLStats user / roster player, see config.example.toml.
    aliases: dict = field(default_factory=dict)
    data_dir: Path = Path("collector-data")


def load_config(path: Path | None) -> Config:
    raw: dict = {}
    if path is not None and path.exists():
        raw = tomllib.loads(path.read_text(encoding="utf-8"))

    api = ApiConfig(**raw.get("api", {}))
    obs = ObsConfig(**raw.get("obs", {}))
    data_dir = Path(raw.get("storage", {}).get("data_dir", "collector-data"))

    # Environment wins over the file so the key never has to be written to disk.
    api.url = os.environ.get("NHLSTATS_API_URL", api.url).rstrip("/")
    api.key = os.environ.get("NHLSTATS_API_KEY", api.key)
    obs.password = os.environ.get("NHLSTATS_OBS_PASSWORD", obs.password)

    return Config(api=api, obs=obs, vision=VisionConfig(**raw.get("vision", {})),
                  aliases=dict(raw.get("aliases", {})), data_dir=data_dir)
