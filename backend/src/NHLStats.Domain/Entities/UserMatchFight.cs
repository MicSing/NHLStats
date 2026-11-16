namespace NHLStats.Domain.Entities;

/// <summary>A fight a user took part in during a match, with its outcome. Statistics only.</summary>
public class UserMatchFight
{
    public int Id { get; set; }
    public int UserMatchId { get; set; }
    /// <summary>The roster player who fought (null when unknown).</summary>
    public int? RosterPlayerId { get; set; }
    public FightOutcome Outcome { get; set; }
    public int? MatchEventProposalId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public UserMatch? UserMatch { get; set; }
    public RosterPlayer? RosterPlayer { get; set; }
}
