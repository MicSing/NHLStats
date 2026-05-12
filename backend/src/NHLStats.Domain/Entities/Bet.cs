namespace NHLStats.Domain.Entities;

public class Bet
{
    public Guid Id { get; set; }
    public string CreatedBy { get; set; } = null!;
    public decimal Stake { get; set; }
    public decimal TotalOdds { get; set; }
    public BetStatus Status { get; set; } = BetStatus.Pending;
    public DateTime CreatedOn { get; set; }
    public DateTime? UpdatedOn { get; set; }
    public DateTime? EvaluatedOn { get; set; }

    public ICollection<BetLeg> Legs { get; set; } = new List<BetLeg>();
}
