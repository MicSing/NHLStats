namespace NHLStats.Domain.Entities;

public class BetLeg
{
    public int Id { get; set; }
    public Guid BetId { get; set; }
    public int MatchId { get; set; }
    public BetType BetType { get; set; }
    public int? UserId { get; set; }
    public int? TeamId { get; set; }
    public decimal Odds { get; set; }
    public int Occasions { get; set; } = 1;
    public BetLegStatus Status { get; set; } = BetLegStatus.Pending;
    public DateTime? EvaluatedOn { get; set; }

    /// <summary>
    /// Which odds formula/margin produced this leg's <see cref="Odds"/>. 1.0 = the original
    /// multiplicative formula (odds = margin / probability) with per-bet-type margins
    /// 0.80/0.75/0.70. 2.0 = the current formula (odds = 1 + (1/probability - 1) * margin) with
    /// a single BettingConstants.Margin. New legs are stamped with the current version at
    /// placement time; BetService.RecalculateHistoricalTicketOddsAsync uses this (together with
    /// <see cref="Probability"/>) to reprice a leg to any chosen version, and to mark it done, so
    /// it's safe to re-run. See BettingConstants.LegacyOddsFormulaVersion / CurrentOddsFormulaVersion.
    /// </summary>
    public decimal OddsFormulaVersion { get; set; } = 1.0m;

    /// <summary>
    /// The raw base probability <see cref="Odds"/> was computed from, before margin was applied —
    /// null only for legs placed before this field existed. Storing it means repricing this leg to
    /// any OddsFormulaVersion later is an exact forward computation (via OddsFormula.Compute)
    /// instead of an approximation reconstructed by inverting the currently-stored Odds.
    /// </summary>
    public decimal? Probability { get; set; }

    public Bet? Bet { get; set; }
    public Match? Match { get; set; }
    public User? User { get; set; }
    public Team? Team { get; set; }
}

public enum BetLegStatus
{
    Pending = 0,
    Won = 1,
    Lost = 2,
    Cancelled = 3
}
