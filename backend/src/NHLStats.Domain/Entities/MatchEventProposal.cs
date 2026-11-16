namespace NHLStats.Domain.Entities;

/// <summary>
/// An event suggested by an external client (the Collector) for a Match. A proposal has no
/// effect on scores, points or stats until an admin confirms it; confirming replays it through
/// the same code path as manual entry and links the resulting <see cref="MatchEvent"/>.
/// </summary>
public class MatchEventProposal
{
    public int Id { get; set; }
    public int MatchId { get; set; }
    public int ApiKeyId { get; set; }

    /// <summary>Client-generated id; (ApiKeyId, ClientEventId) is unique so re-sends are idempotent.</summary>
    public string ClientEventId { get; set; } = null!;

    public MatchEventType EventType { get; set; }
    public bool IsOpponent { get; set; }
    /// <summary>Same meaning as <see cref="MatchEvent.EventSubtype"/> (e.g. "P2", "OT", "SO").</summary>
    public string? EventSubtype { get; set; }
    public GoalType? GoalType { get; set; }

    /// <summary>The app user the client believes is responsible (null = unknown or computer-controlled).</summary>
    public int? UserId { get; set; }
    public int? RosterPlayerId { get; set; }

    /// <summary>Up to two assists on a goal, each by a user's roster player (plain columns, no FK).</summary>
    public int? Assist1UserId { get; set; }
    public int? Assist1RosterPlayerId { get; set; }
    public int? Assist2UserId { get; set; }
    public int? Assist2RosterPlayerId { get; set; }
    /// <summary>For <see cref="MatchEventType.Fight"/>: outcome from the user's point of view.</summary>
    public FightOutcome? FightOutcome { get; set; }

    public int? Period { get; set; }
    /// <summary>Game clock as shown on screen, e.g. "12:34".</summary>
    public string? GameClock { get; set; }
    /// <summary>Game state at the time of the event, e.g. "5v5", "PP", "PK", "4v4", "3v3".</summary>
    public string? Strength { get; set; }
    public ProposalConfidence Confidence { get; set; } = ProposalConfidence.Low;
    /// <summary>Free-form text the client read or the operator typed (e.g. banner OCR).</summary>
    public string? Note { get; set; }
    /// <summary>Client-side reference to a screenshot/clip (e.g. a file name saved by OBS).</summary>
    public string? MediaRef { get; set; }
    public DateTime? OccurredAt { get; set; }

    public ProposalStatus Status { get; set; } = ProposalStatus.Proposed;
    public int? MatchEventId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }

    public Match? Match { get; set; }
    public ApiKey? ApiKey { get; set; }
}
