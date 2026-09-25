namespace NHLStats.Domain.Entities;

public enum OddsBetType
{
    TeamWin = 0,
    UserGoal = 1,
    UserPenalty = 2,
    Draw = 3,
    TeamWinOrDraw = 4,
    UserPlusPoint = 5,
    UserMinusPoint = 6,
    MatchTotalGoals = 7,
    HostedShutoutWin = 8,
    OpponentShutoutWin = 9
}

public class MatchOdds
{
    public int Id { get; set; }
    public int MatchId { get; set; }
    public OddsBetType BetType { get; set; }
    public int? TargetId { get; set; }
    public decimal Probability { get; set; }
    public decimal Odds { get; set; }
    public DateTime ComputedOn { get; set; }

    // User-event markets only: the lowest bettable "N+ occasions" threshold, its odds, and the
    // highest threshold still above the probability floor. Precomputed during recalculation so
    // reading odds never has to walk the user's match history. Null for other markets and for
    // rows written before these columns existed.
    public int? MinOccasions { get; set; }
    public decimal? EffectiveOdds { get; set; }
    public int? MaxOccasions { get; set; }

    public Match? Match { get; set; }
}
