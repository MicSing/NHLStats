using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record UserMatchDto(
    int Id,
    int UserId,
    string? UserName,
    int? MatchId,
    int SeasonId,
    int TotalPlus,
    int TotalMinus);

public record CreateUserMatchDto(
    int UserId);

// ─── Aggregated data ──────────────────────────────────────────────────────────────────

public record AggregatedSeasonDataDto(
    int Id,
    int UserId,
    int SeasonId,
    int TotalPlus,
    int TotalMinus,
    int MatchesPlayed);

public record CreateAggregatedSeasonDataDto(
    int UserId,
    int SeasonId,
    int TotalPlus,
    int TotalMinus,
    int MatchesPlayed);

public record UpdateAggregatedSeasonDataDto(
    int UserId,
    int SeasonId,
    int TotalPlus,
    int TotalMinus,
    int MatchesPlayed);


// ─── Points ──────────────────────────────────────────────────────────────────

public record UserMatchPointDto(
    int Id,
    int UserMatchId,
    int PointReasonId,
    string? PointReasonName,
    bool IsPositive,
    int Count);

public record CreateUserMatchPointDto(
    int PointReasonId,
    int Count);

public record UpdateUserMatchPointDto(
    int PointReasonId,
    int Count);

// ─── Goals ───────────────────────────────────────────────────────────────────

public record UserMatchGoalDto(
    int Id,
    int UserMatchId,
    int RosterPlayerId,
    string? PlayerFirstName,
    string? PlayerSurname,
    int Count,
    GoalType GoalType);

public record CreateUserMatchGoalDto(
    int RosterPlayerId,
    int Count,
    GoalType GoalType = GoalType.Regular);

public record UpdateUserMatchGoalDto(
    int RosterPlayerId,
    int Count,
    GoalType GoalType = GoalType.Regular);

// ─── Penalties ────────────────────────────────────────────────────────────────

public record UserMatchPenaltyDto(
    int Id,
    int UserMatchId,
    int RosterPlayerId,
    string? PlayerFirstName,
    string? PlayerSurname,
    int Count);

public record CreateUserMatchPenaltyDto(
    int RosterPlayerId,
    int Count);

public record UpdateUserMatchPenaltyDto(
    int RosterPlayerId,
    int Count);
