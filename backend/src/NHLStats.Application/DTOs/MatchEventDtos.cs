using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record MatchEventDto(
    int Id,
    int MatchId,
    int OrderIndex,
    MatchEventType EventType,
    bool IsOpponent,
    string? EventSubtype,
    int? UserMatchGoalId,
    int? UserMatchPenaltyId,
    int? UserMatchPointId,
    int? RosterPlayerId,
    string? PlayerName,
    int? UserMatchId,
    string? UserName,
    string? PointReasonName,
    PointType? PointType,
    GoalType? GoalType,
    DateTime CreatedAt);

public record CreateTeamMatchEventDto(
    MatchEventType EventType,
    bool IsOpponent,
    string? EventSubtype = null);

public record ReorderMatchEventsDto(
    List<int> EventIds);
