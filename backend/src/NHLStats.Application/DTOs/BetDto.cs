using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record BetDto(
    Guid Id,
    int MatchId,
    BetType BetType,
    int? UserId,
    int? TeamId,
    decimal Amount,
    decimal Odds,
    BetStatus Status,
    string CreatedBy,
    DateTime CreatedOn,
    DateTime? UpdatedOn,
    DateTime? EvaluatedOn);

public record BetHistoryDto(
    Guid Id,
    int MatchId,
    int MatchNumber,
    string? HomeTeamName,
    string? AwayTeamName,
    BetType BetType,
    int? UserId,
    string? BetTargetName,
    int? TeamId,
    decimal Amount,
    decimal Odds,
    BetStatus Status,
    decimal? WonAmount,
    DateTime CreatedOn,
    DateTime? EvaluatedOn);

public record CreateBetDto(
    BetType BetType,
    int? UserId,
    int? TeamId,
    decimal Amount);

public record UpdateBetDto(
    BetType BetType,
    int? UserId,
    int? TeamId,
    decimal Amount);

public record BettingBalanceDto(
    decimal AvailableBalance,
    decimal MaxWinCap,
    decimal TotalPositiveCash,
    decimal TotalWonProfit,
    decimal TotalPendingStake,
    decimal TotalLostStake);
