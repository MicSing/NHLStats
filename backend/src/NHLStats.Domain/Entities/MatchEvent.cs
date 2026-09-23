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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Match? Match { get; set; }
    public UserMatchGoal? UserMatchGoal { get; set; }
    public UserMatchPenalty? UserMatchPenalty { get; set; }
    public UserMatchPoint? UserMatchPoint { get; set; }
}
