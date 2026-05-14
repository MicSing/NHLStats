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
    public BetLegStatus Status { get; set; } = BetLegStatus.Pending;
    public DateTime? EvaluatedOn { get; set; }

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
