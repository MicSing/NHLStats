using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

/// <summary>
/// Computes and inverts odds for a specific BetLeg.OddsFormulaVersion, so historical tickets can
/// be (re)priced under any formula version the admin picks — not just always "the current one".
///
/// Four versions exist today, all sharing one of two formula *shapes*:
///  - 1.0 (legacy): offeredOdds = margin / probability, with per-bet-type margins
///    0.80/0.75/0.70 — the only formula/margin combination that was ever actually live before
///    this file existed. Pinned here as historical fact, independent of whatever
///    BettingConstants.Margin/HistoricalMargin are set to today or in the future.
///  - 2.0 (historical), 2.1 (uniform) and 2.2 (current) all use the additive shape,
///    offeredOdds = 1 + (1/probability - 1) * margin — 2.0 uses BettingConstants.HistoricalMargin
///    (deliberately gentler, meant only for repricing old settled tickets), 2.1 uses
///    BettingConstants.Margin for every bet type, and 2.2 uses MatchMargin(matchId): Margin minus a
///    per-match random reduction in [0, MaxMatchMarginReduction]. 2.2 is what
///    BettingOddsService.ComputeOdds uses for all new/upcoming odds and what new BetLegs are
///    stamped with — it keeps matches against the same opponent from all getting identical odds.
///
/// A BetLeg placed since BetLeg.Probability was introduced always has its true base probability
/// on hand, so repricing it to any version is an exact forward computation via Compute(). Only
/// legs from before that (BetLeg.Probability == null) need Invert() first, to recover an implied
/// probability from their currently-stored Odds — a one-time backfill, after which Compute()
/// alone is enough for that leg from then on.
/// </summary>
public static class OddsFormula
{
    private const decimal LegacyAppMargin = 0.80m;
    private const decimal LegacyTeamMargin = 0.75m;
    private const decimal LegacyOccasionsMargin = 0.70m;

    /// <summary>The margin the given formula version applies for this leg shape.</summary>
    /// <param name="isHostedTeamLeg">
    /// Only meaningful for BetType.TeamWin under version 1.0: the original odds computation
    /// priced the hosted team's TeamWin leg with the default (App) margin and the opponent's
    /// with TeamMargin — an asymmetry that predates this file and must be preserved.
    /// </param>
    /// <param name="matchId">The leg's match — only 2.2 (Current) varies the margin per match.</param>
    public static decimal MarginFor(OddsFormulaTier version, BetType betType, int occasions, bool isHostedTeamLeg, int matchId)
    {
        if (version == OddsFormulaTier.Historical) return BettingConstants.HistoricalMargin;
        if (version == OddsFormulaTier.Uniform) return BettingConstants.Margin;
        if (version == OddsFormulaTier.Current) return MatchMargin(matchId);

        return betType switch
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

    /// <summary>
    /// The 2.2 margin for a match: BettingConstants.Margin minus a reduction in
    /// [0, BettingConstants.MaxMatchMarginReduction] (0.0001 steps). The reduction is random across
    /// matches but seeded by the match id, so it's stable for a given match — odds don't jitter
    /// every time they're recalculated, and odds shown to a bettor still match the ones locked in
    /// at placement.
    /// </summary>
    public static decimal MatchMargin(int matchId)
    {
        const int steps = 10_000;
        var maxStep = (uint)(BettingConstants.MaxMatchMarginReduction * steps);
        var reduction = (decimal)(Mix((uint)matchId) % (maxStep + 1)) / steps;
        return BettingConstants.Margin - reduction;
    }

    // murmur3 fmix32 finalizer — a stable (process-independent) integer hash, so consecutive
    // match ids land on unrelated reductions.
    private static uint Mix(uint h)
    {
        h ^= h >> 16;
        h *= 0x85ebca6b;
        h ^= h >> 13;
        h *= 0xc2b2ae35;
        h ^= h >> 16;
        return h;
    }

    /// <summary>Computes the odds for a probability under the given formula version and margin.</summary>
    public static decimal Compute(OddsFormulaTier version, decimal probability, decimal margin)
    {
        probability = Math.Clamp(probability, 0.01m, 0.99m);
        var odds = version == OddsFormulaTier.Legacy
            ? margin / probability
            : 1m + (1m / probability - 1m) * margin;
        return Math.Floor(odds * 100m) / 100m;
    }

    /// <summary>
    /// Recovers the implied probability from odds locked in under the given formula
    /// version/margin. Returns null if the odds can't be inverted safely (e.g. below 1.0, or the
    /// implied probability would fall outside (0, 1)).
    /// </summary>
    public static decimal? Invert(OddsFormulaTier version, decimal margin, decimal odds)
    {
        if (odds < 1m) return null;

        decimal probability;
        if (version == OddsFormulaTier.Legacy)
        {
            probability = margin / odds;
        }
        else
        {
            var denominator = odds - 1m + margin;
            if (denominator <= 0m) return null;
            probability = margin / denominator;
        }

        return probability is > 0m and < 1m ? probability : null;
    }
}
