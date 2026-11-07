# Automatický zber dát z videa — plán

## Prehľad

Cieľ je zbierať štatistiky zápasu (góly, asistencie, vylúčenia, buly, striedania) automaticky z obrazu hry namiesto ručného zadávania.

Program **Collector** beží na PC/Macu. Obraz z konzoly berie cez HDMI capture kartu, sleduje ho počas zápasu a posiela rozpoznané udalosti do backendu ako **návrhy**. Admin ich po zápase v UI potvrdí alebo opraví. Až potom sa z nich stanú `UserMatchGoal` / `UserMatchPenalty` / `UserMatchPoint`.

```
PS5/Xbox ──HDMI──► splitter ──► TV
                        └────► capture karta ──USB──► PC/Mac (Collector, Python)
                                                         │  HTTPS + API kľúč
                                                         ▼
                                              NHLStats.Api (ingest, návrhy)
                                                         │
                                              Frontend: potvrdenie návrhov
```

### Kľúčové rozhodnutia

| Rozhodnutie | Voľba |
|-------------|-------|
| Kde beží spracovanie | PC/Mac pri konzole (nie RPi). Ak je počítač inde, obraz sa posiela streamom (OBS/SRT) a pridá sa iba oneskorenie. |
| Zdroj obrazu | HDMI splitter + USB capture karta (UVC). Na PS5 vypnúť HDCP. |
| Identita používateľa | **Farba indikátora pod hráčom = ovládač = používateľ.** Farba sa nemení počas celého zápasu, NHL hráč pod ňou áno. |
| Kto je pod farbou | Live tracking: 1 analyzovaná snímka/s, čítanie čísla dresu, rozhodnutie podľa viacerých čítaní (nie jednej snímky). |
| Pravidlo podľa pozície | Iba **kontrola**, a len pri hre 5 na 5 v riadnom hracom čase. V oslabení, presilovke, 4 na 4 a predĺžení neplatí (viď nižšie). |
| Zápis do DB | Collector posiela iba návrhy. Automatický zápis iba ak sa zhodnú dva nezávislé zdroje. |
| Buly | Primárne zo súhrnnej obrazovky po zápase (FO vyhraté/celkom podľa hráča). |
| Autentifikácia Collectora | API kľúč zariadenia (nie JWT používateľa), iba na ingest endpointy. |
| Jazyk UI hry | Angličtina (lepšie OCR). |

---

## Prečo nestačí pravidlo „pozícia = používateľ“

Hráte s pevnými pozíciami (`SeasonUser.Position`), ale hra pozície v niektorých situáciách mení:

- **Oslabenie:** keď fauluje obranca, ide na jeho miesto krídelník. Napr. používateľ zamknutý na RW hrá v oslabení obranu.
- **Predĺženie (3 na 3) a hra 4 na 4:** menej hráčov na ľade a pozície sa poprehadzujú.
- **Presilovka:** presilovkové formácie môžu dať hráča na inú pozíciu, než hrá pri 5 na 5.
- **Striedanie:** pod farbou sa mení NHL hráč (červený C: najprv MacKinnon, potom Kadri).

Z toho vyplýva:

1. **Primárny zdroj pravdy je tracking farby.** Farba vždy patrí tomu istému používateľovi, nech hrá na akejkoľvek pozícii.
2. **Pravidlo podľa pozície** (gól dal center, center hrá červený, gól je červeného) sa používa iba pri hre 5 na 5 v riadnom čase, a to ako druhý nezávislý zdroj na kontrolu.
3. Collector musí poznať **stav hry**: 5 na 5 / presilovka / oslabenie / 4 na 4 / 3 na 3 / predĺženie / nájazdy. Číta ho zo scoreboardu (box s časom vylúčenia, označenie periódy „OT“ / „SO“).
4. Mimo hry 5 na 5 sa udalosť bez spoľahlivého trackingu **vždy** pošle na ručné potvrdenie.
5. Collector si bude **logovať pozorované presuny** (napr. „pri oslabení po faule LD prešiel RW na LD“). Ak sa ukáže, že hra presúva hráčov podľa pevných pravidiel, dajú sa neskôr doplniť ako tretí zdroj.

---

## Rozhodovanie pri udalosti

```
udalosť (zmena skóre / banner vylúčenia)
  │
  ├─ meno z bannera ──fuzzy match──► RosterPlayer
  │
  ├─ A) tracking: ktorá farba mala tohto hráča v čase udalosti (ring buffer)
  ├─ B) pravidlo podľa pozície (len pri stave 5 na 5 v riadnom čase)
  │
  ├─ A == B              → Confidence = High, auto-potvrdenie
  ├─ iba A, mimo 5 na 5  → Confidence = Medium, na potvrdenie
  ├─ A != B              → Confidence = Low, na potvrdenie (so screenshotom)
  ├─ ani A, ani B        → hráč ovládaný počítačom, nikomu nepripísať (na potvrdenie)
  └─ nič nerozpoznané    → Confidence = Low, na potvrdenie
```

To isté platí pre asistencie (každá asistencia sa vyhodnocuje samostatne) aj pre vylúčenia. Pri oneskorenom vylúčení treba ísť v ring bufferi ďalej do minulosti (až ~20 s).

---

## Fáza 0 — Zber dát (bez kódu)

- [ ] Kúpiť HDMI splitter a USB capture kartu, overiť obraz v OBS na PC/Macu (PS5: vypnúť HDCP)
- [ ] Nahrať 3–5 celých zápasov v 1080p vrátane obrazovky so zostavami a súhrnu po zápase
- [ ] Mať v nahrávkach aspoň: góly pri 5 na 5, presilovke, oslabení, predĺžení, vylúčenia obrancov, nájazdy
- [ ] Zistiť v nastaveniach hry, či sa dá nad indikátorom zobraziť meno alebo číslo hráča (výrazne by to zjednodušilo tracking)
- [ ] Zapísať farby ovládačov a ich priradenie hráčom
- [ ] Vytiahnuť snímky a označiť ich (Label Studio / Roboflow): indikátor podľa farby, číslo dresu, banner gólu, banner vylúčenia, scoreboard, typ obrazovky

---

## Fáza 1 — Backend: dátový model

Všetko cez TDD (testy v `backend/tests/`), migrácia cez `dotnet ef migrations add`.

### 1.1 Farby používateľov v zápase
- [ ] Entita `MatchUserColor { Id, MatchId, UserId, Color (enum: Blue, Red, Green, Pink, …) }`, unikátne `(MatchId, Color)` a `(MatchId, UserId)`
- [ ] Predvolené farby na úrovni sezóny (`SeasonUser.DefaultColor`), skopírujú sa do nového zápasu
- [ ] Testy: vytvorenie, unikátnosť, predvyplnenie zo sezóny

### 1.2 Zostava zápasu
- [ ] Entita `MatchLineup { Id, MatchId, RosterPlayerId, Unit (enum: EvenStrength, PowerPlay, PenaltyKill, Overtime), LineNumber, Slot (LW/C/RW/LD/RD/G) }`
- [ ] Endpoint na uloženie a načítanie zostavy (vyplní Collector z OCR obrazovky so zostavami alebo admin ručne)
- [ ] Testy: zostava sa dá uložiť, hráč musí patriť do rosteru sezóny (`SeasonRosterPlayer`)

### 1.3 Asistencie
- [ ] Entita `UserMatchAssist { Id, UserMatchId, RosterPlayerId, UserMatchGoalId?, Count }`
- [ ] `MatchEventType.Assist` a `MatchEvent.UserMatchAssistId`
- [ ] Rozhodnúť, či asistencia znamená aj `PointReason` (peniaze), alebo len štatistiku (otvorená otázka)

### 1.4 Buly
- [ ] `UserMatch.FaceoffsWon`, `UserMatch.FaceoffsTaken` (nullable, aby historické dáta zostali bez hodnoty)

### 1.5 Striedania (voliteľné)
- [ ] Entita `MatchShift { Id, MatchId, UserId, RosterPlayerId, Slot, Period, StartGameClock, EndGameClock, Strength }`
- [ ] Neskôr z nej: čas na ľade používateľa, plus/mínus na ľade

### 1.6 Návrhy udalostí
- [ ] `MatchEvent` rozšíriť o: `Status (Proposed, Confirmed, Rejected)`, `Source (Manual, Collector)`, `Confidence (High, Medium, Low)`, `Period`, `GameClock`, `Strength`, `SnapshotPath`
- [ ] Existujúce záznamy: `Status = Confirmed`, `Source = Manual`
- [ ] Návrh udalosti **ešte nevytvára** `UserMatchGoal`/`UserMatchPenalty`/`UserMatchPoint`, vznikajú až potvrdením
- [ ] Testy: potvrdenie návrhu vytvorí správne záznamy, zamietnutie nevytvorí nič, auto-potvrdené (High) sa správa ako potvrdené

---

## Fáza 2 — Backend: Ingest API

- [ ] Autentifikácia cez API kľúč: hlavička `X-Api-Key`, kľúče uložené ako hash, správa kľúčov iba pre admina
- [ ] `POST /api/ingest/matches/{matchId}/events`: dávka návrhov udalostí, idempotentná podľa `ClientEventId` (opakované odoslanie nevytvorí duplicitu)
- [ ] `POST /api/ingest/matches/{matchId}/snapshots`: upload screenshotu k udalosti
- [ ] `PUT /api/ingest/matches/{matchId}/lineup`: zostava z OCR
- [ ] `POST /api/ingest/matches/{matchId}/summary`: súhrn po zápase (G/A/PIM/FO podľa hráča)
- [ ] `POST /api/ingest/matches/{matchId}/shifts`: striedania (voliteľne)
- [ ] `GET /api/ingest/matches/{matchId}/context`: Collector si stiahne roster, farby, pozície používateľov a zostavu
- [ ] Integračné testy (`WebApplicationFactory`): bez kľúča 401, so zlým kľúčom 401, idempotencia, validácia hráčov a používateľov

---

## Fáza 3 — Frontend

- [ ] Nastavenie farieb používateľov (sezóna a zápas)
- [ ] Editor zostavy zápasu (predvyplnený z OCR, ručne opraviteľný)
- [ ] **Fronta návrhov** pri zápase: zoznam udalostí so screenshotom, confidence, stavom hry a navrhnutým používateľom. Akcie: potvrdiť, zmeniť používateľa alebo hráča, zamietnuť. Hromadné potvrdenie všetkých High.
- [ ] Porovnanie súhrnu po zápase s potvrdenými udalosťami (napr. „súhrn: Kadri 1 G, potvrdené: 0“) ako upozornenie na chýbajúcu udalosť
- [ ] Zobrazenie asistencií a buly v štatistikách používateľa
- [ ] Testy cez Vitest + RTL + MSW

---

## Fáza 4 — Collector (Python, `collector/` v repe)

### 4.1 Kostra
- [ ] Python 3.12, OpenCV, `ultralytics` (YOLO), PaddleOCR alebo Tesseract, `rapidfuzz`, `httpx`
- [ ] Vstup: capture karta (index zariadenia), RTMP/SRT stream alebo **video súbor** (vývoj a testy na nahrávkach)
- [ ] Ring buffer: 10 snímok/s v RAM (~20 s), analýza 1 snímky/s, pri udalosti podrobná analýza bufferu
- [ ] Konfigurácia: výrezy oblastí obrazovky pre konkrétnu verziu hry (NHL 26, …) v YAML

### 4.2 Detektory
- [ ] **Typ obrazovky:** hra / replay / banner / prestávka / zostava / súhrn (perceptual hash a šablóny)
- [ ] **Scoreboard:** skóre, perióda, čas, stav hry (vylúčenie, OT, SO). Číslice cez template matching.
- [ ] **Banner gólu:** strelec, asistencie, typ (PP/SH)
- [ ] **Banner vylúčenia:** hráč, dôvod, dĺžka
- [ ] **Indikátory:** YOLO model (farba + tvar). Samotný filter na farbu nestačí kvôli čiaram na ľade a reklamám.
- [ ] **Čísla dresov:** výrez nad indikátorom, klasifikátor číslic alebo OCR

### 4.3 Tracker hráčov
- [ ] Stav pre každú farbu: aktuálny `RosterPlayer`, slot, istota, čas posledného potvrdenia
- [ ] Kandidáti iba zo zostavy pre aktuálny stav hry (center pri 5 na 5: 4 hráči; v oslabení: hráči z PK formácie)
- [ ] Hysteréza: zmena hráča až po 2–3 zhodných čítaniach nového čísla
- [ ] Väzba medzi spoluhráčmi: istota jedného hráča zvyšuje pravdepodobnosť formácie u ostatných
- [ ] **Buly ako kotva:** pri každom buly intenzívnejšie čítanie čísel (stoja, kamera je blízko)
- [ ] Reset alebo zníženie istoty pri zmene stavu hry (vylúčenie, koniec vylúčenia, začiatok OT)
- [ ] Logovanie pozorovaných presunov pozícií pri zmene stavu hry (podklad k sekcii vyššie)
- [ ] Výstup: striedania (`MatchShift`)

### 4.4 Priradenie udalostí
- [ ] Implementovať rozhodovanie podľa sekcie „Rozhodovanie pri udalosti“
- [ ] Odstránenie duplicít: gól sa počíta iba pri zmene skóre (replay skóre nemení)
- [ ] Zmena skóre bez prečítaného bannera: návrh s neznámym strelcom (Low)

### 4.5 Súhrn po zápase
- [ ] OCR obrazovky súhrnu (G/A/PIM/FO% / FO podľa hráča), odoslanie na `/summary`
- [ ] Alternatíva: vyhodnotenie screenshotu súhrnu modelom s rozpoznávaním obrazu (odolnejšie voči zmenám UI medzi ročníkmi)

### 4.6 Testy
- [ ] pytest na označených snímkach (golden testy): scoreboard, bannery, čísla
- [ ] End-to-end test na nahrávke: očakávaný zoznam udalostí oproti výstupu Collectora (presnosť, chýbajúce, falošné)

---

## Fáza 5 — Live zobrazenie (voliteľné)

- [ ] SignalR hub: návrhy udalostí a skóre sa počas zápasu zobrazujú vo frontende
- [ ] Indikátor stavu Collectora (pripojený, číta obraz, posledná udalosť)

---

## Poradie práce

1. Fáza 0 (nahrávky) a súbežne Fáza 1 + 2 (backend nepotrebuje hardvér)
2. Fáza 4.5: súhrn po zápase je najrýchlejší prínos (asistencie a buly hneď)
3. Fáza 3: fronta návrhov
4. Fáza 4.1–4.4: live detekcia a tracking
5. Fáza 5

## Riziká

| Riziko | Zmiernenie |
|--------|------------|
| HDCP blokuje capture | PS5: vypnúť HDCP v nastaveniach, prípadne splitter, ktorý HDCP odstráni |
| Nový ročník NHL zmení UI | Výrezy v konfigurácii pre každú verziu hry, golden testy na nahrávkach |
| Čísla dresov sú zle čitateľné | Hlasovanie z viacerých čítaní, obmedzenie kandidátov zostavou, buly ako kotva |
| Presuny pozícií v oslabení a predĺžení | Tracking ako primárny zdroj, pravidlo podľa pozície iba pri hre 5 na 5 v riadnom čase |
| Oneskorené vylúčenie | Dlhší ring buffer (~20 s) |
| Chybný zápis ovplyvní peniaze | Iba návrhy, automatické potvrdenie len pri zhode dvoch zdrojov |

## Otvorené otázky

- [ ] Je asistencia aj bodom za peniaze (`PointReason`), alebo len štatistikou?
- [ ] Majú sa buly premietnuť do bodov?
- [ ] Hrá niekedy viac používateľov rovnakú pozíciu?
- [ ] Ukazuje hra nad indikátorom meno alebo číslo hráča?
- [ ] Ako presne hra presúva pozície v oslabení a pri 3 na 3? (zistiť z nahrávok)
