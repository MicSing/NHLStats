namespace NHLStats.Domain.Entities;

public class SeasonRosterPlayer
{
    public int Id { get; set; }
    public int SeasonId { get; set; }
    public int RosterPlayerId { get; set; }
    public int TeamId { get; set; }
    public string? Position { get; set; }
    public bool IsActive { get; set; } = true;

    public Season? Season { get; set; }
    public RosterPlayer? RosterPlayer { get; set; }
    public Team? Team { get; set; }
}
