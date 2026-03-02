namespace NHLStats.Domain.Entities;

public class UserMatch
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? MatchId { get; set; }
    public int SeasonId { get; set; }
    public int TotalPlus { get; set; }
    public int TotalMinus { get; set; }

    public User? User { get; set; }
    public Match? Match { get; set; }
    public Season? Season { get; set; }
    public ICollection<UserMatchPoint>? Points { get; set; }
    public ICollection<UserMatchGoal>? Goals { get; set; }
    public ICollection<UserMatchPenalty>? Penalties { get; set; }
}
