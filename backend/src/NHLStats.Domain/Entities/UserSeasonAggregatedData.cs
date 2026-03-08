namespace NHLStats.Domain.Entities;

public class UserSeasonAggregatedData
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int SeasonId { get; set; }
    public int TotalPlus { get; set; }
    public int TotalMinus { get; set; }
    public int MatchesPlayed { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public User? User { get; set; }
    public Season? Season { get; set; }
}
