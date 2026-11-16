namespace NHLStats.Domain.Entities;

public class MatchEvent
{
    public int Id { get; set; }
    public int MatchId { get; set; }
    public int OrderIndex { get; set; }
    public MatchEventType EventType { get; set; }
    public bool IsOpponent { get; set; }
    public string? EventSubtype { get; set; }

    public int? UserMatchGoalId { get; set; }
    public int? UserMatchPenaltyId { get; set; }
    public int? UserMatchPointId { get; set; }

    /// <summary>Period the event happened in (1–3, 4 = overtime), when known (e.g. from the Collector).</summary>
    public int? Period { get; set; }
    /// <summary>Game clock shown on screen at the event, e.g. "12:34".</summary>
    public string? GameClock { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Match? Match { get; set; }
    public UserMatchGoal? UserMatchGoal { get; set; }
    public UserMatchPenalty? UserMatchPenalty { get; set; }
    public UserMatchPoint? UserMatchPoint { get; set; }
}
