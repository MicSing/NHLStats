namespace NHLStats.Domain.Entities;

public class UserMatch
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int MatchId { get; set; }
    public int SeasonId { get; set; }

    public User? User { get; set; }
    public Match? Match { get; set; }
    public Season? Season { get; set; }
    public ICollection<UserMatchPoint> Points { get; set; } = new List<UserMatchPoint>();
    public ICollection<UserMatchGoal> Goals { get; set; } = new List<UserMatchGoal>();
    public ICollection<UserMatchPenalty> Penalties { get; set; } = new List<UserMatchPenalty>();
}
