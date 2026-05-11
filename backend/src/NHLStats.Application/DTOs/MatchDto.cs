using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record MatchDto(
    int Id,
    int SeasonId,
    int MatchNumber,
    int HomeTeamId,
    string? HomeTeamName,
    int AwayTeamId,
    string? AwayTeamName,
    int HomeScore,
    int AwayScore,
    DateTime? MatchDate,
    CompletionType CompletionType);

public record FutureMatchDto(
    int Id,
    int SeasonId,
    string SeasonName,
    int MatchNumber,
    int HomeTeamId,
    string? HomeTeamName,
    int AwayTeamId,
    string? AwayTeamName,
    int? HostedTeamId,
    IEnumerable<UserMatchInfoDto>? UserMatches,
    BetDto? Bet);

public record UserMatchInfoDto(
    int UserId,
    string? UserName);

public record CreateMatchDto(
    int HomeTeamId,
    int AwayTeamId);

public record UpdateMatchDto(
    int HomeTeamId,
    int AwayTeamId,
    DateTime? MatchDate,
    int HomeScore,
    int AwayScore,
    CompletionType CompletionType);

public record BatchUserPointsDto(
    int UserId,
    int Plus,
    int Minus);

public record BatchCreateMatchDto(
    int HomeTeamId,
    int AwayTeamId,
    DateTime? MatchDate = null,
    int HomeScore = 0,
    int AwayScore = 0,
    CompletionType CompletionType = CompletionType.None,
    IEnumerable<BatchUserPointsDto>? UserPoints = null);
