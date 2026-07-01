using NHLStats.Application.DTOs;

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
    Task<int> RecalculatePlusMinusOddsAsync();
}
