using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record BetLegDto(
    int Id,
    int MatchId,
    int MatchNumber,
    string? HomeTeamName,
    string? AwayTeamName,
    BetType BetType,
    int? UserId,
    int? TeamId,
    string? TargetName,
    decimal Odds,
    BetLegStatus Status,
    DateTime? EvaluatedOn);

public record BetDto(
    Guid Id,
    string ShortId,
    string CreatedBy,
    string CreatedByName,
    decimal Stake,
    decimal TotalOdds,
    BetStatus Status,
    decimal? WonAmount,
    DateTime CreatedOn,
    DateTime? UpdatedOn,
    DateTime? EvaluatedOn,
    IReadOnlyList<BetLegDto> Legs);

public record CreateBetLegDto(
    int MatchId,
    BetType BetType,
    int? UserId,
    int? TeamId);

public record CreateBetDto(
    decimal Stake,
    IReadOnlyList<CreateBetLegDto> Legs);

public record BettingBalanceDto(
    decimal AvailableBalance,
    decimal MaxWinCap,
    decimal TotalPositiveCash,
    decimal TotalWonProfit,
    decimal TotalPendingStake,
    decimal TotalLostStake);
