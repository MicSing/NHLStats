# Retroactive recalculation of multi-leg plus/minus bet odds

`UserPlusPoint` and `UserMinusPoint` BetLegs are now capped at one per Match per Bet (previously unlimited, allowing a ticket to stack several plus/minus legs on the same Match and multiply their odds together). Historical Won Bets placed under the old rule keep their existing BetLeg rows untouched — Won/Lost status is a historical record — but an admin-triggered global recalculation pass rewrites `Bet.TotalOdds` for any Won Bet with 2+ plus/minus legs on the same Match: legs from that Match collapse to the single highest odds among them (not the whole ticket's highest), other legs and other Matches' plus/minus groups keep multiplying in normally. Recalculation is a pure function of a Bet's legs, safe to re-run anytime — there is no reconciliation ledger, since balance/payout figures are computed live from `Bet.TotalOdds` rather than stored per-transaction.

## Considered Options

- **Global max across the whole ticket** — rejected: too punitive, would also shrink odds contributed by legs that were never part of the violation (e.g. an unrelated TeamWin leg).
- **Leave historical bets untouched** — rejected: the whole point of the rule change was that stacking plus/minus legs on one Match was judged to inflate odds unfairly; leaving old winners unrecalculated would let that inflation stand.
