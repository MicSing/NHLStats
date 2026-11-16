namespace NHLStats.Domain.Entities;

/// <summary>
/// An assist by a user's roster player in a match. Statistics only: it never creates a
/// <see cref="UserMatchPoint"/> and does not affect earnings.
/// </summary>
public class UserMatchAssist
{
    public int Id { get; set; }
    public int UserMatchId { get; set; }
    public int RosterPlayerId { get; set; }
    /// <summary>The goal this assist belongs to, when the scorer was a user (plain column, no FK).</summary>
    public int? UserMatchGoalId { get; set; }
    /// <summary>The goal's match event (plain column, no FK); deleting that event deletes the assist.</summary>
    public int? MatchEventId { get; set; }
    /// <summary>The Collector proposal it was confirmed from, if any (plain column, no FK).</summary>
    public int? MatchEventProposalId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public UserMatch? UserMatch { get; set; }
    public RosterPlayer? RosterPlayer { get; set; }
}
