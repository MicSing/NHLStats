namespace NHLStats.Domain.Entities;

/// <summary>
/// The colour of the ring the game draws under the player of each user position. It stays the
/// same from match to match, so the Collector can tell which user skates with which player.
/// </summary>
public class PositionColor
{
    public SeasonUserPosition Position { get; set; }

    /// <summary>A named colour (red, orange, yellow, green, cyan, blue, pink) or #rrggbb.</summary>
    public string Color { get; set; } = null!;
}
