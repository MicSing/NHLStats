namespace NHLStats.Application.DTOs;

public record SeasonEventNotificationDto(
    int SeasonId,
    int MatchId,
    int UserMatchId,
    string? ActorUserId,
    string? ActorUserName,
    string EventType,
    string EventSubType,
    string? PlayerName,
    int Count,
    string? TargetUserName = null,
    string? HomeTeamName = null,
    string? AwayTeamName = null,
    int? HomeScore = null,
    int? AwayScore = null
);
