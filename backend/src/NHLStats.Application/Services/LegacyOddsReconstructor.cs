using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

/// <summary>
/// Reprices BetLeg rows that were locked in before the margin/odds-formula change (see
/// BettingOddsService.ComputeOdds) so historical tickets read correctly under today's pricing.
///
/// A placed BetLeg only ever stored the final locked <c>Odds</c> value, never the probability
/// that produced it, so there's nothing to recompute from directly. Instead this inverts the
/// OLD formula (offeredOdds = legacyMargin / probability) using the OLD per-bet-type margins —
/// which is the only formula/margin combination that has ever actually been live — to recover
/// the implied probability, then reprices it with the CURRENT formula
/// (offeredOdds = 1 + (fairOdds - 1) * margin) and the current unified margin.
///
/// The old margins are pinned here as historical fact, independent of whatever
/// BettingConstants.Margin is set to today or in the future.
/// </summary>
public static class LegacyOddsReconstructor
{
    private const decimal LegacyAppMargin = 0.80m;
    private const decimal LegacyTeamMargin = 0.75m;
    private const decimal LegacyOccasionsMargin = 0.70m;

    /// <param name="betType">The leg's bet type.</param>
    /// <param name="occasions">The leg's locked Occasions (1 for non-occasion bet types).</param>
    /// <param name="isHostedTeamLeg">
    /// Only meaningful for BetType.TeamWin: the original odds computation priced the hosted
    /// team's TeamWin leg with the default (App) margin and the opponent's with TeamMargin —
    /// an asymmetry that predates this change and must be preserved to invert correctly.
    /// </param>
    /// <param name="legacyOdds">The leg's currently stored (pre-change) locked Odds.</param>
    /// <returns>The corrected odds, or null if the stored odds can't be inverted safely.</returns>
    public static decimal? Reconstruct(BetType betType, int occasions, bool isHostedTeamLeg, decimal legacyOdds)
    {
        if (legacyOdds < 1m) return null;

        var legacyMargin = LegacyMarginFor(betType, occasions, isHostedTeamLeg);
        var probability = legacyMargin / legacyOdds;
        if (probability <= 0m || probability >= 1m) return null;

        var fairOdds = 1m / probability;
        var odds = 1m + (fairOdds - 1m) * BettingConstants.Margin;
        return Math.Floor(odds * 100m) / 100m;
    }

    private static decimal LegacyMarginFor(BetType betType, int occasions, bool isHostedTeamLeg) => betType switch
    {
        BetType.TeamWin => isHostedTeamLeg ? LegacyAppMargin : LegacyTeamMargin,
        BetType.TeamWinOrDraw => LegacyTeamMargin,
        BetType.TeamDraw => LegacyTeamMargin,
        BetType.UserGoal or BetType.UserPenalty or BetType.UserPlusPoint or BetType.UserMinusPoint =>
            occasions > 1 ? LegacyOccasionsMargin : LegacyAppMargin,
        // MatchTotalGoals, HostedShutoutWin, OpponentShutoutWin
        _ => LegacyAppMargin
    };
}
