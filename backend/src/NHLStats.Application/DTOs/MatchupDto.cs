using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

/// <summary>
/// Summary of the finished matches between the two teams of an upcoming match within the same
/// season. Leaders are listed without their totals; several users are returned when tied.
/// </summary>
public record MatchupDto(
    int MatchId,
    int SeasonId,
    int HomeTeamId,
    string? HomeTeamName,
    int AwayTeamId,
    string? AwayTeamName,
    int MatchesPlayed,
    IEnumerable<MatchupResultDto> LastMatches,
    IEnumerable<UserMatchInfoDto> TopScorers,
    IEnumerable<UserMatchInfoDto> MostPenalized,
    IEnumerable<UserMatchInfoDto> MostPlusPoints,
    IEnumerable<UserMatchInfoDto> MostMinusPoints);

public record MatchupResultDto(
    int Id,
    int MatchNumber,
    int HomeTeamId,
    string? HomeTeamName,
    int AwayTeamId,
    string? AwayTeamName,
    int HomeScore,
    int AwayScore,
    DateTime? MatchDate,
    CompletionType CompletionType,
    MatchPhase Phase);
