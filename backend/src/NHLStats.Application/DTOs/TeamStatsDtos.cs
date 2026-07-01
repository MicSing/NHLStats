using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

// ─── Team stats (hosted team vs opponent) ─────────────────────────────────────

public record TeamOptionDto(int Id, string Name, string ShortName);

public record TeamStatsPairedContributorDto(string Name, int Count);

public record TeamStatsLeaderDto(string Name, int Count, IEnumerable<TeamStatsPairedContributorDto> PairedContributors);

public record TeamStatsSummaryDto(
    int HostedTeamId,
    int OpponentTeamId,
    int MatchesPlayed,
    TeamStatsLeaderDto? TopScoringUser,
    TeamStatsLeaderDto? TopScoringPlayer,
    TeamStatsLeaderDto? TopPenalizedUser,
    TeamStatsLeaderDto? TopPenalizedPlayer,
    TeamStatsLeaderDto? TopPlusUser,
    TeamStatsLeaderDto? TopMinusUser,
    int TotalPlusPoints,
    int TotalMinusPoints,
    double AvgPlusPerMatch,
    double AvgMinusPerMatch,
    double AvgGoalsPerMatch,
    double AvgPenaltiesPerMatch);

public record TeamStatsMatchDto(
    int MatchId,
    int SeasonId,
    string SeasonName,
    DateTime MatchDate,
    bool IsHome,
    int HomeScore,
    int AwayScore,
    CompletionType CompletionType);
