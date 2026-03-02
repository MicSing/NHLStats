namespace NHLStats.Application.DTOs;

public record MatchDto(
    int Id,
    int SeasonId,
    int HomeTeamId,
    string? HomeTeamName,
    int AwayTeamId,
    string? AwayTeamName,
    int HomeScore,
    int AwayScore,
    DateTime MatchDate);

public record CreateMatchDto(
    int HomeTeamId,
    int AwayTeamId,
    int HomeScore,
    int AwayScore,
    DateTime MatchDate);

public record UpdateMatchDto(
    int HomeTeamId,
    int AwayTeamId,
    int HomeScore,
    int AwayScore,
    DateTime MatchDate);
