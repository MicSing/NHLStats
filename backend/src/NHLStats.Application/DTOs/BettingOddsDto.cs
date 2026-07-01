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
    decimal EffectiveOdds,
    int MaxOccasions);

public record OccasionsOddsDto(int Occasions, decimal Odds, int MaxOccasions);

public record MatchTotalGoalsOddsDto(int Threshold, decimal Odds);

public record MatchOddsDto(
    TeamWinOddsDto? TeamWin,
    IReadOnlyList<UserOddsDto> UserGoal,
    IReadOnlyList<UserOddsDto> UserPenalty,
    IReadOnlyList<UserOddsDto> UserPlusPoint,
    IReadOnlyList<UserOddsDto> UserMinusPoint,
    IReadOnlyList<MatchTotalGoalsOddsDto> MatchTotalGoals,
    decimal? HostedShutoutWinOdds,
    decimal? OpponentShutoutWinOdds,
    DateTime ComputedOn);
