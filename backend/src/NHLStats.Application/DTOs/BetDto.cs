using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record BetLegDto(
    int Id,
    int MatchId,
    int MatchNumber,
    int SeasonId,
    string? HomeTeamName,
    string? AwayTeamName,
    BetType BetType,
    int? UserId,
    int? TeamId,
    string? TargetName,
    decimal Odds,
    int Occasions,
    BetLegStatus Status,
    DateTime? EvaluatedOn,
    bool IsAnonymized = false);

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
    int? TeamId,
    int Occasions = 1,
    // Odds the client showed when building the ticket. When set and the server's current odds
    // differ, the ticket is rejected with the new odds instead of being placed at a price the
    // user never saw.
    decimal? ExpectedOdds = null);

public record CreateBetDto(
    decimal Stake,
    IReadOnlyList<CreateBetLegDto> Legs);

public record OddsChangedLegDto(
    int LegIndex,
    int MatchId,
    BetType BetType,
    int? UserId,
    int? TeamId,
    int Occasions,
    decimal ExpectedOdds,
    decimal CurrentOdds);

public record PlaceBetResult(
    BetDto? Bet,
    string? Error,
    IReadOnlyList<OddsChangedLegDto>? OddsChanged = null);

/// <summary>Optional target for the admin "recalculate historical ticket odds" action — defaults to the current formula version when omitted.</summary>
public record RecalculateHistoricalOddsRequestDto(decimal? TargetVersion);

public record BettingBalanceDto(
    decimal AvailableBalance,
    decimal MaxWinCap,
    decimal TotalPositiveCash,
    decimal TotalWonProfit,
    decimal TotalPendingStake,
    decimal TotalLostStake);
