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
    decimal TotalEarnings);

public record AllTimeEarningsDto(
    IEnumerable<UserEarningsDto> UserEarnings,
    decimal TotalCollected,
    decimal TotalExpenses,
    decimal Balance);
