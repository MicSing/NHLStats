# NHLStats Collector

Program na PC/Macu pri konzole, ktorý počas zápasu zapisuje udalosti do NHLStats cez API kľúč.
Udalosti prídu do NHLStats ako **návrhy**. Skóre, body ani štatistiky sa nezmenia, kým ich admin nepotvrdí.

Zatiaľ udalosti zadávaš krátkymi príkazmi z klávesnice. Automatické rozpoznávanie z obrazu
(pozri `AUTOMATION_PLAN.md`, Fáza 4) bude posielať rovnaké návrhy tým istým API.

```
Xbox ──HDMI──► capture karta ──USB──► OBS (stream/záznam, Replay Buffer)
                                        │ obs-websocket (screenshot + klip pri udalosti)
                                        ▼
                                   Collector ──HTTPS + X-Api-Key──► NHLStats API (návrhy)
                                                                         │
                                                         admin potvrdí / zamietne
```

## Inštalácia

Potrebuješ Python 3.11 alebo novší.

```bash
cd collector
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e .
cp config.example.toml config.toml
```

## Nastavenie

1. **API kľúč.** V NHLStats ako admin zavolaj `POST /api/admin/api-keys` s `{ "name": "Collector PC" }`
   (obrazovka v UI príde v ďalšom kroku). Kľúč (`nhls_…`) sa ukáže **iba raz**. Vlož ho do `config.toml`
   alebo do premennej prostredia `NHLSTATS_API_KEY`. Zrušíš ho cez `DELETE /api/admin/api-keys/{id}`.
2. **Adresa API** v `config.toml` (`[api].url`).
3. **OBS (voliteľné).**
   - Xbox: *Settings → General → TV & display options → Video modes* → vypni *Allow HDCP*, inak capture karta ukáže čierny obraz.
   - OBS: pridaj capture kartu ako *Video Capture Device*.
   - OBS: *Nástroje → Nastavenia WebSocket servera* → zapni server, port 4455, heslo daj do `config.toml` (alebo `NHLSTATS_OBS_PASSWORD`).
   - OBS: *Nastavenia → Výstup → Replay Buffer* → zapni (napr. 20 s) a spusti *Start Replay Buffer*. Pri každej udalosti sa uloží klip.
   - Screenshoty sa ukladajú do `collector-data/match-<id>/`. Ukladá ich OBS, takže OBS musí bežať na tom istom počítači ako Collector.

## Spustenie

```bash
nhlcollector                 # vyberieš otvorený zápas zo zoznamu
nhlcollector --match 123     # konkrétny zápas
```

Hráčov zápasu (používateľov) treba mať v NHLStats pridaných do zápasu („Inicializovať používateľov“),
inak sa gól používateľa nedá potvrdiť.

## Príkazy

| Príkaz | Význam |
|---|---|
| `g 2 mack` | náš gól: používateľ č. 2, hráč podľa časti mena (`pp` / `sh` pre presilovku / oslabenie) |
| `g` | náš gól bez strelca, doplníš ho pri potvrdení |
| `o` | gól súpera (`o pp`, `o sh`) |
| `p 3 kadri` | náš trest |
| `po` | trest súpera |
| `so 1 rantanen` / `soo` | gól v nájazdoch náš / súpera |
| `n` | ďalšia perióda (P1 → P2 → P3 → OT) |
| `end`, `end ot`, `end so` | koniec zápasu |
| `@12:34` | čas z obrazovky, pridáš ku ktorémukoľvek príkazu |
| `x` | zruší poslednú ešte neodoslanú udalosť |
| `s` | stav: odoslané, čakajúce, potvrdené/zamietnuté na serveri |
| `u`, `h`, `q` | používatelia a súpiska, pomoc, koniec |

Ak hráč v mene nie je jednoznačný, Collector uprednostní hráča na pozícii používateľa (center → center).

## Keď vypadne internet

Každá udalosť sa najprv zapíše do `collector-data/match-<id>/outbox.json` a až potom sa odošle.
Neodoslané sa skúšajú znova každých 15 s a pri ďalšom spustení. Server rozpozná opakované odoslanie
(podľa `clientEventId`), takže nevzniknú duplicity.

## Potvrdzovanie v NHLStats

Kým nie je hotová obrazovka vo frontende, dá sa to cez API (JWT admina):

- `GET /api/matches/{matchId}/proposals?status=Proposed`
- `POST /api/matches/{matchId}/proposals/{id}/confirm` s voliteľnými opravami
  `{ "userId": 1, "rosterPlayerId": 2, "isOpponent": false, "goalType": "PowerPlay", "clearUser": false }`
- `POST /api/matches/{matchId}/proposals/{id}/reject`

Potvrdenie ide rovnakou cestou ako ručný zápis v aplikácii: gól používateľa vytvorí gól hráča a zvýši skóre,
trest vytvorí trest, gól a trest súpera a periódy idú ako udalosti tímu.
Body za gól v presilovke alebo oslabení (výber príjemcu bodu) zatiaľ treba pridať ručne.

## Testy

```bash
pip install -e ".[dev]"
pytest
```
