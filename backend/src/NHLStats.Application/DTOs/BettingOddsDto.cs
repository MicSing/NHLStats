namespace NHLStats.Application.DTOs;

public record TeamWinOddsDto(
    int HomeTeamId,
    decimal HomeOdds,
    int AwayTeamId,
    decimal AwayOdds,
    decimal? DrawOdds,
    decimal? Home1XOdds,
    decimal? Away1XOdds);

public record UserOddsDto(
    int UserId,
    string? UserName,
    decimal Odds,
    int MinOccasions,
    decimal EffectiveOdds);

public record OccasionsOddsDto(int Occasions, decimal Odds);

public record MatchOddsDto(
    TeamWinOddsDto? TeamWin,
    IReadOnlyList<UserOddsDto> UserGoal,
    IReadOnlyList<UserOddsDto> UserPenalty,
    IReadOnlyList<UserOddsDto> UserPlusPoint,
    IReadOnlyList<UserOddsDto> UserMinusPoint,
    DateTime ComputedOn);
