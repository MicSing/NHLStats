namespace NHLStats.Domain.Entities;

public class Bet
{
    public Guid Id { get; set; }
    public int MatchId { get; set; }
    public BetType BetType { get; set; }
    public int? UserId { get; set; }
    public int? TeamId { get; set; }
    public decimal Amount { get; set; }
    public decimal Odds { get; set; }
    public BetStatus Status { get; set; } = BetStatus.Pending;
    public string CreatedBy { get; set; } = null!;
    public DateTime CreatedOn { get; set; }
    public DateTime? UpdatedOn { get; set; }
    public DateTime? EvaluatedOn { get; set; }

    public Match? Match { get; set; }
    public User? User { get; set; }
    public Team? Team { get; set; }
}
