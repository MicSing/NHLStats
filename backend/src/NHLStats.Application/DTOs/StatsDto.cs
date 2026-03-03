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
    int AwayTeamId,
    string? AwayTeamName,
    int HomeScore,
    int AwayScore);

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

