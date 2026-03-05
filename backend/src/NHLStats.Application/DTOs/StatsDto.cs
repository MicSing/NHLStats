using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

// ─── Season stats per user ────────────────────────────────────────────────────

public record UserSeasonStatsDto(
    int UserId,
    string UserName,
    int TotalPlus,
    int TotalMinus,
    decimal Earnings);

// ─── Top roster player (goals / penalties) ────────────────────────────────────

public record TopRosterPlayerDto(
    int RosterPlayerId,
    string FirstName,
    string Surname,
    string? TeamShortName,
    int Count);

public record UserGoalCountDto(int UserId, string UserName, int Count);

public record RosterScorerByUserDto(
    int RosterPlayerId,
    string FirstName,
    string Surname,
    string? TeamShortName,
    int TotalCount,
    IEnumerable<UserGoalCountDto> UserCounts);

public record UserPenaltyCountDto(int UserId, string UserName, int Count);

public record RosterPenalizedByUserDto(
    int RosterPlayerId,
    string FirstName,
    string Surname,
    string? TeamShortName,
    int TotalCount,
    IEnumerable<UserPenaltyCountDto> UserCounts);

// ─── Weekly match grouping ────────────────────────────────────────────────────

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
    CompletionType CompletionType);

public record WeekGroupDto(
    int WeekNumber,
    IEnumerable<WeeklyMatchDto> Matches);

// ─── All-time earnings ────────────────────────────────────────────────────────

public record UserEarningsDto(
    int UserId,
    string UserName,
    int TotalPlus,
    int TotalMinus,
    decimal TotalEarnings,
    decimal TotalPaid,
    decimal RemainingBalance);

public record AllTimeEarningsDto(
    IEnumerable<UserEarningsDto> UserEarnings,
    decimal TotalCollected,
    decimal CanBeCollected,
    decimal TotalExpenses,
    decimal Balance);

// ─── Per-season per-user earnings (for stacked chart) ────────────────────────

public record SeasonUserEarningsDto(
    int UserId,
    string UserName,
    decimal Earnings);

public record SeasonEarningsEntryDto(
    int SeasonId,
    string SeasonName,
    IEnumerable<SeasonUserEarningsDto> Users);

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
    int TotalMinus);

public record PeriodPlusMinusDto(
    string Label,
    IEnumerable<UserPeriodPlusMinusDto> Users);

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
