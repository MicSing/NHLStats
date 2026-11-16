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
pip install -e ".[vision]"      # vision = Pillow pre detekciu zmeny skóre
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

## Lokálna stránka: čo appka vidí

Po spustení otvor **http://localhost:8787** (iný port: `--port 9000`, vypnúť: `--port 0`). Stránka beží iba na tvojom počítači.

- **Živý obraz z OBS** (asi 1 snímka za sekundu) s vyznačenými oblasťami, ktoré appka sleduje.
- **Kalibrácia:** klikni na oblasť (*Skóre*, *Čas*, *Tretina*, *Banner*) a ťahaj myšou po obraze. Skóre označ tesne okolo čísel oboch tímov, bez času zápasu. Východzie oblasti sedia na scoreboard EA NHL vľavo hore (dva riadky tímov pod sebou, vpravo čas a pod ním tretina). Uloží sa do `collector-data/regions.json`.
- **Zmena skóre:** pruh ukazuje, ako veľmi sa oblasť skóre líši od posledného stabilného stavu. Keď prekročí prah (červená čiara, dá sa zmeniť) aspoň na 2 snímky, appka sa opýta.
- **Otázky:** karta so snímkou z toho momentu a tlačidlami *Náš gól / Gól súpera / Náš trest / Trest súpera*. Pri našej udalosti vyberieš používateľa a hráča (hráči na jeho pozícii sú prví), pri góle typ (bežný, presilovka, oslabenie) a voliteľne čas. *Nič sa nestalo* otázku zahodí. *Zapísať udalosť* otvorí otázku ručne.
- **Zapísané udalosti** so stavom: *neodoslané*, *čaká na potvrdenie*, *potvrdené*, *zamietnuté* (stav sa ťahá z NHLStats každých 5 s).
- Periódy, koniec zápasu a príkazy ako v termináli.

V testovacej fáze appka nerozpoznáva, kto skóroval: iba zistí, že sa skóre zmenilo, a opýta sa teba.
Tvoje odpovede sú zároveň podklad na neskoršie automatické rozpoznávanie.

## Čítanie scoreboardu (OCR)

S Tesseractom appka sama číta skóre, čas a tretinu a bannery gólov:

1. Nainštaluj Tesseract: Windows inštalátor z github.com/UB-Mannheim/tesseract/wiki, `brew install tesseract` alebo `apt install tesseract-ocr`.
2. `pip install -e ".[ocr]"`
3. Po spustení stránka ukáže, čo appka prečítala (časť *OCR*). Ak čísla nesedia, dolaď oblasti v kalibrácii.

Čo z toho vyplýva:

- Každá udalosť dostane presný čas a tretinu. Zmena tretiny, predĺženie, nájazdy a koniec zápasu sa zapíšu samé.
- Keď sa zmení skóre, appka vie, ktorý tím skóroval. Pri našom góle predvyplní strelca a asistencie z bannerov (gól a potom asistencie) a čas z okamihu, keď sa banner ukázal.
- **Ovládaný hráč:** appka stále číta box vľavo dole (číslo a meno hráča, ktorého konzola práve ovláda). Keď banner strelca nemá alebo ho neprečíta, navrhne hráča, ktorý bol ovládaný tesne pred gólom.
- **Farby používateľov:** v `config.toml` v časti `[colors]` nastav farbu krúžku každého používateľa. Appka číta menovku pod krúžkom a pamätá si, s ktorým hokejistom každý používateľ naposledy hral (päť minút). Gól alebo asistenciu toho hokejistu potom pripíše správnemu používateľovi. Pamäť vidno na stránke v časti *OCR*.
- Meno v banneri hľadá na súpiske sezóny. Používateľa určí podľa farieb, a keď ich nepozná, podľa pozície. Ak banner ukazuje prezývky, nastav ich v `config.toml` v časti `[aliases]`.
- Ak scoreboard ukazuje hostí hore a domácich dole, nastav `[vision] home_first = false`.
- V nájazdoch sa pri góle z bannera opýta, či skóroval náš hráč, a predvyplní ho.

Všetko sú len návrhy: na stránke ich potvrdíš alebo opravíš a v NHLStats ich ešte schváli admin.

## Príkazy

| Príkaz | Význam |
|---|---|
| `g 2 mack` | náš gól: používateľ č. 2, hráč podľa časti mena (`pp` / `sh` pre presilovku / oslabenie) |
| `g` | náš gól bez strelca, doplníš ho pri potvrdení |
| `o` | gól súpera (`o pp`, `o sh`) |
| `g 2 mack a 1 kadri a 3 rant` | gól s asistenciami (najviac 2, `a <používateľ> <hráč>`) |
| `f 2 makar w` | bitka: `w` vyhral, `l` prehral, `d` nerozhodne (hráč je nepovinný) |
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

**Asistencie a bitky sú iba štatistika**: nevytvárajú body ani peniaze. Súčty (góly, asistencie,
kanadské body G + A, bitky vyhraté/prehraté/nerozhodné) sú na `GET /api/seasons/{seasonId}/collector-stats`.
Tretina a čas z hodín sa po potvrdení uložia aj k udalosti v NHLStats.

## Testy

```bash
pip install -e ".[dev]"
pytest
```
