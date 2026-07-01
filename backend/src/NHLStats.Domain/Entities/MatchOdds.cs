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

    public Match? Match { get; set; }
}
