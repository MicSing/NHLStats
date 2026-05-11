namespace NHLStats.Application.DTOs;

public record TeamWinOddsDto(
    int HomeTeamId,
    decimal HomeOdds,
    int AwayTeamId,
    decimal AwayOdds);

public record UserOddsDto(
    int UserId,
    string? UserName,
    decimal Odds);

public record MatchOddsDto(
    TeamWinOddsDto? TeamWin,
    IReadOnlyList<UserOddsDto> UserGoal,
    IReadOnlyList<UserOddsDto> UserPenalty,
    DateTime ComputedOn);
