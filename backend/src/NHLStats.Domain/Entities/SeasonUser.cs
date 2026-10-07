namespace NHLStats.Domain.Entities;

public class SeasonUser
{
    public int Id { get; set; }
    public int SeasonId { get; set; }
    public int UserId { get; set; }
    public SeasonUserPosition? Position { get; set; }
    /// <summary>Only season-active users are added to new matches.</summary>
    public bool IsActive { get; set; } = true;

    public Season? Season { get; set; }
    public User? User { get; set; }
}
