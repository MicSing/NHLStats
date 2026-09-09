# Shutout-win legs are correlated with plus/minus-point legs — prevention and retroactive fix

When a match completes, `UserMatchService.ApplyMatchEndAutoPointsAsync` unconditionally adds a
Positive `UserMatchPoint` (reason "Not Scoring A Goal") to every rostered player whenever the
opponent scored 0 goals, and a Negative one to every rostered player whenever the hosted team
scored 0 goals — before `BetService.EvaluateMatchBetsAsync` grades any bets. Since `UserPlusPoint`
and `UserMinusPoint` legs are graded Won by counting `UserMatchPoint` rows of the matching type,
this makes two leg combinations guaranteed rather than independent, for any rostered player and
only at `Occasions == 1` (a higher threshold needs an extra, non-guaranteed point):

- `HostedShutoutWin` Won **⟹** `UserPlusPoint(any rostered user, Occasions == 1)` Won.
- `OpponentShutoutWin` Won **⟹** `UserMinusPoint(any rostered user, Occasions == 1)` Won.

Combining either pair in one ticket let the naive "multiply every leg's odds" math price a
guaranteed outcome as if it were two independent ones, overstating `Bet.TotalOdds` and therefore
the payout. This is the same class of bug already fixed once in
[0002](0002-retroactive-plus-minus-odds-recalculation.md) for same-type plus/minus-point stacking
— this ADR extends that fix rather than introducing a parallel mechanism.

`PlaceBetAsync` now rejects a new ticket that combines `HostedShutoutWin` with a same-match
`UserPlusPoint(Occasions == 1)` leg (or `OpponentShutoutWin` with `UserMinusPoint(Occasions == 1)`),
mirrored client-side for immediate UX feedback. Historical Won bets keep their existing `BetLeg`
rows untouched — Won/Lost status is a historical record — but the recalculation pass renamed from
`RecalculatePlusMinusOddsAsync` to `RecalculateCorrelatedLegOddsAsync` now collapses this
correlation too: for a Won bet, `HostedShutoutWin` and every same-match `UserPlusPoint(Occasions
== 1)` leg (symmetrically for `OpponentShutoutWin`/`UserMinusPoint`) are grouped as one redundant
set and rewritten to their single highest odds, exactly like the existing same-type-stack
collapse. The grouping uses union-find rather than two independent passes, because a bet can be
hit by both rule kinds on the same match at once (a `HostedShutoutWin` leg alongside 2+ legacy
same-type `UserPlusPoint` legs, predating both caps) — see "Considered Options" below for why that
matters.

## Considered Options

- **Two independent recalculation passes (one per bug)** — rejected: a bet with both violation
  types stacked on one match needs a single combined pass. Worked example: shutout odds 1.10,
  plusA 1.50, plusB 1.30 — the correct collapsed answer is `max(1.10, 1.50, 1.30) = 1.50` (all
  three legs are transitively redundant with each other). Two independent passes run
  back-to-back would instead compute `max(1.50, 1.30) * 1.10 = 1.65` — still wrong, since neither
  pass alone sees that the shutout leg is also redundant with the plus-point group.
- **Block only at placement time, leave historical bets alone** — rejected, same reasoning as
  0002: already-inflated payouts on Won bets should not stand uncorrected.
- **Global max across the whole ticket** — rejected, same reasoning as 0002: too punitive to
  legs that were never part of the violation (e.g. an unrelated `TeamWin` leg on another match).
- **Automatic recompute hook at settlement time** — considered, explicitly deferred: recalculation
  stays admin-triggered only, matching the 0002 precedent. The one-time backfill run (via the
  renamed admin endpoint/button) covers the pre-fix backlog; going forward, new tickets can no
  longer be placed with this violation, so the residual risk is limited to bets that were already
  Pending at deploy time and later resolve to Won — the same residual risk 0002 already accepted
  for its own violation class.
