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
