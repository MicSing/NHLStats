using NHLStats.Application.Services;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

// ─── Season stats per user ────────────────────────────────────────────────────

public record UserPointsMetricsDto(
    int UserId,
    int TotalPlus,
    int TotalMinus);

public record SeasonPointsStatsSummaryDto(
    int SeasonId,
    IEnumerable<UserPointsMetricsDto> UserStats);

public record UserGoalsMetricsDto(
    int UserId,
    int TotalGoals);

public record SeasonGoalsStatsSummaryDto(
    int SeasonId,
    IEnumerable<UserGoalsMetricsDto> UserStats);

public record UserPenaltiesMetricsDto(
    int UserId,
    int TotalPenalties);

public record SeasonPenaltiesStatsSummaryDto(
    int SeasonId,
    IEnumerable<UserPenaltiesMetricsDto> UserStats);

// ─── Top roster player (goals / penalties) ────────────────────────────────────

public record TopRosterPlayerDto(
    int RosterPlayerId,
    string FirstName,
    string Surname,
    string? TeamShortName,
    int Count);

public record UserGoalCountDto(int UserId, string UserName, int Count);

public record RosterScorerBySeasonDto(
    int RosterPlayerId,
    int SeasonId,
    string FirstName,
    string Surname,
    int TotalCount,
    IEnumerable<UserGoalCountDto> UserCounts);

public record AllTimeRosterScorerDto(
    int RosterPlayerId,
    string FirstName,
    string Surname,
    int TotalCount,
    IEnumerable<UserGoalCountDto> UserCounts);

public record UserPenaltyCountDto(int UserId, string UserName, int Count);

public record RosterPenalizedBySeasonDto(
    int RosterPlayerId,
    int SeasonId,
    string FirstName,
    string Surname,
    int TotalCount,
    IEnumerable<UserPenaltyCountDto> UserCounts);

public record AllTimeRosterPenalizedDto(
    int RosterPlayerId,
    string FirstName,
    string Surname,
    int TotalCount,
    IEnumerable<UserPenaltyCountDto> UserCounts);

// ─── Weekly match grouping ────────────────────────────────────────────────────

public record WeeklyMatchUserDto(
    int UserId,
    string UserName,
    int TotalPlus,
    int TotalMinus,
    int TotalGoals,
    int TotalPenalties);

public record WeeklyMatchDto(
    int MatchId,
    int WeekNumber,
    DateTime MatchDate,
    int HomeTeamId,
    string? HomeTeamName,
    string? HomeTeamShortName,
    int AwayTeamId,
    string? AwayTeamName,
    string? AwayTeamShortName,
    int HomeScore,
    int AwayScore,
    CompletionType CompletionType,
    IEnumerable<WeeklyMatchUserDto> Users);

public record WeekGroupDto(
    int WeekNumber,
    int TotalPlus,
    int TotalMinus,
    IEnumerable<WeeklyMatchDto> Matches);

// ─── All-time earnings ────────────────────────────────────────────────────────

public record UserEarningsDto(
    int UserId,
    decimal Earnings);

public record SeasonalUserEarningsDto(
    int SeasonId,
    IEnumerable<UserEarningsDto> UserEarnings);

public record AllTimeEarningsDto(
    IEnumerable<UserEarningsDto> UserEarnings,
    decimal TotalCollected,
    decimal CanBeCollected,
    decimal TotalExpenses);

// ─── Per-user goals & penalties totals for a season ──────────────────────────

public record UserSeasonTotalsDto(
    int UserId,
    string UserName,
    int TotalGoals,
    int TotalPenalties);

// ─── Plus/minus trend per period (season or week) ───────────────────────────

public record UserPeriodPlusMinusDto(
    int UserId,
    string UserName,
    int TotalPlus,
    int TotalMinus,
    int MatchesPlayed);

public record PeriodPlusMinusDto(
    string Label,
    IEnumerable<UserPeriodPlusMinusDto> Users,
    int TotalPeriodMatches);

// ─── Point-reason breakdown ───────────────────────────────────────────────────

public record PointReasonBreakdownItemDto(
    int PointReasonId,
    string PointReasonName,
    bool IsPositive,
    int TotalCount);

public record UserPointReasonBreakdownDto(
    int UserId,
    string UserName,
    IEnumerable<PointReasonBreakdownItemDto> Items);

// ─── Head-to-head ─────────────────────────────────────────────────────────────

public record HeadToHeadUserResultDto(
    int UserId,
    string UserName,
    int TotalPlus,
    int TotalMinus);

public record HeadToHeadMatchDto(
    int MatchId,
    int SeasonId,
    string SeasonName,
    DateTime MatchDate,
    string HomeTeamName,
    string HomeTeamShortName,
    string AwayTeamName,
    string AwayTeamShortName,
    int HomeScore,
    int AwayScore,
    CompletionType CompletionType,
    IEnumerable<HeadToHeadUserResultDto> UserResults);

// ─── User match history ───────────────────────────────────────────────────────

public record UserMatchSummaryDto(
    int MatchId,
    DateTime MatchDate,
    string OpponentName,
    string OpponentShortName,
    int HomeScore,
    int AwayScore,
    bool IsHome,
    int TotalPlus,
    int TotalMinus,
    int GoalCount,
    int PenaltyCount,
    int SeasonId,
    string SeasonName);

// ─── Consolidated dashboard data ──────────────────────────────────────────────

public record DashboardDataDto(
    IEnumerable<SeasonPointsStatsSummaryDto> SeasonStats,
    IEnumerable<SeasonalUserEarningsDto> EarningsBySeason,
    IEnumerable<PeriodPlusMinusDto> TrendData,
    IEnumerable<RosterScorerBySeasonDto> RosterScorers,
    IEnumerable<RosterPenalizedBySeasonDto> RosterPenalized,

    IEnumerable<UserPointsMetricsDto> AllTimeStats,
    AllTimeEarningsDto AllTimeEarnings,
    IEnumerable<PeriodPlusMinusDto> AllTimePlusMinusTrend,
    IEnumerable<AllTimeRosterScorerDto> AllTimeRosterScorers,
    IEnumerable<AllTimeRosterPenalizedDto> AllTimeRosterPenalized);

// --- Consolidated Season data ─────────────────────────────────────────────────

public record SeasonUserDataDto(
    int UserId,
    int TotalPlus,
    int TotalMinus,
    int TotalGoals,
    int TotalPenalties,
    decimal Earnings);

public record SeasonalUserDataDto(
    int SeasonId,
    IEnumerable<SeasonUserDataDto> UsersData);

public record PlayerTopStatsDto(
    string Name,
    int Count);

public record SeasonTopRosterPlayersDto(
    int SeasonId,
    PlayerTopStatsDto? TopScorer,
    PlayerTopStatsDto? TopPenalty,
    PlayerTopStatsDto? TopPpScorer,
    PlayerTopStatsDto? TopShScorer
);

public record SeasonTotalsDto(
    // Table data (user's total plus, minus, goals, penalties, earnings)
    IEnumerable<SeasonalUserDataDto> UsersData,
    // Top scorers and penalized, SH and PP goal scorers players for the season
    IEnumerable<SeasonTopRosterPlayersDto> TopRosterPlayers);

// ─── Consolidated Finances stats ───────────────────────────────────────────────────

public record UserFinancialStatsDto(
    int UserId,
    int TotalPluses,
    int TotalMinuses,
    decimal Collected,
    decimal TotalEarnings,
    decimal CanBeCollected);

public record FinancialStatsDto(
    decimal TotalCollected,
    decimal TotalExpenses,
    decimal CanBeCollected,
    decimal TotalEarnings,
    IEnumerable<ExpenseDto> Expenses,
    IEnumerable<UserFinancialStatsDto> FinancesByUser);