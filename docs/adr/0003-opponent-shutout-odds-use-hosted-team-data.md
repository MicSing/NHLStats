# OpponentShutoutWin odds computed from the hosted team's own record, not the opponent's

`HostedShutoutWin` and `OpponentShutoutWin` were both originally built to load Team-specific Odds Buckets (season, last10, h2h, home/away) from *their own* team's match history — the natural mirror of the existing `TeamWin` model. In practice this made `OpponentShutoutWin` odds meaningless or unavailable: this app only tracks a full season of Matches for the Season's hosted Team, so an opponent Team's "own" season/last10/home-away sample is just whatever handful of Matches it happened to play against the hosted Team — often 1-2 games, sometimes zero outside the current H2H pairing.

Both markets are now computed entirely from the hosted Team's own record: `HostedShutoutWin` measures the hosted Team's shutout-**win** rate, `OpponentShutoutWin` measures the hosted Team's shutout-**loss** rate (hosted Team scored 0 and lost) — same four buckets, opposite outcome being counted. This is the only reliable signal this data model can produce for a "the opponent shuts out the hosted team" claim.

## Considered Options

- **Load the opponent's own match history** (original approach) — rejected: opponent Teams don't have an independent season in this system, so the buckets were near-empty or drawn from an irrelevant/tiny sample, producing odds that looked arbitrary or simply unavailable.
