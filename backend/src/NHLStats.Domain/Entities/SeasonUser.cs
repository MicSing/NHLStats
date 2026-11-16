namespace NHLStats.Domain.Entities;

public class SeasonUser
{
    public int Id { get; set; }
    public int SeasonId { get; set; }
    public int UserId { get; set; }
    public SeasonUserPosition? Position { get; set; }
    /// <summary>
    /// Ring colour in the game set by hand for this season. Null: the colour of the position
    /// (<see cref="PositionColor"/>), so it follows the position when that changes.
    /// </summary>
    public string? Color { get; set; }
    /// <summary>Only season-active users are added to new matches.</summary>
    public bool IsActive { get; set; } = true;

    public Season? Season { get; set; }
    public User? User { get; set; }
}
