using NHLStats.Application.DTOs;
using NHLStats.Application.Services;

namespace NHLStats.Application.Interfaces;

public interface IBetService
{
    Task<IReadOnlyList<BetDto>> GetActiveAsync(string loginId);
    Task<IReadOnlyList<BetDto>> GetHistoryAsync(string loginId, int? seasonId);
    Task<IReadOnlyList<BetDto>> GetAllBetsAsync(string? currentLoginId);
    Task<(BetDto? Bet, string? Error)> PlaceBetAsync(string loginId, CreateBetDto dto);
    Task<(bool Success, string? Error)> CancelBetAsync(Guid betId, string loginId);
    Task CancelBetsForPlayerInMatchAsync(int matchId, int userId);
    Task EvaluateMatchBetsAsync(int matchId);
    Task ResetMatchBetsAsync(int matchId);
    Task<int> RecalculateCorrelatedLegOddsAsync();

    /// <summary>One-time startup bootstrap: recovers BetLeg.Probability for every leg still missing it. Idempotent.</summary>
    Task<int> BackfillLegacyProbabilitiesAsync();

    /// <summary>Reprices historical (Won/Lost) tickets to the given formula version. Defaults to the current version.</summary>
    Task<int> RecalculateHistoricalTicketOddsAsync(decimal targetVersion = BettingConstants.CurrentOddsFormulaVersion);
}
