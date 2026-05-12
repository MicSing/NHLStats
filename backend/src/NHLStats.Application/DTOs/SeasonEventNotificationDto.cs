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
    int Count
);
