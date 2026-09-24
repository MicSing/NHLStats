using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record MatchDto(
    int Id,
    int SeasonId,
    int MatchNumber,
    int HomeTeamId,
    string? HomeTeamName,
    string? HomeTeamShortName,
    int AwayTeamId,
    string? AwayTeamName,
    string? AwayTeamShortName,
    int HomeScore,
    int AwayScore,
    DateTime? MatchDate,
    CompletionType CompletionType,
    MatchPhase Phase,
    int? PlayoffRound);

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
    MatchPhase Phase,
    int? PlayoffRound,
    IEnumerable<UserMatchInfoDto>? UserMatches);

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
    CompletionType CompletionType,
    MatchPhase Phase = MatchPhase.RegularSeason,
    int? PlayoffRound = null);

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

public record CreatePlayoffSeriesDto(
    int OpponentTeamId,
    bool StartsHome);

/// <summary>
/// State of the hosted team's latest playoff round, used to decide whether an admin should be
/// prompted to pick the opponent for the next series.
/// </summary>
public record PlayoffStatusDto(
    int? LastRound,
    int HostedWins,
    int OpponentWins,
    bool SeriesDecided,
    bool HostedTeamWon,
    bool CanCreateNextSeries,
    int? NextRound);

/// <summary>
/// Progress of the background odds calculation for a season's newly generated matches.
/// </summary>
public record OddsRecalculationStatusDto(
    bool InProgress,
    int Pending,
    int Completed,
    int Failed,
    IEnumerable<int> PendingMatchIds,
    IEnumerable<int> CompletedMatchIds,
    DateTime? StartedAt,
    string? LastError);
