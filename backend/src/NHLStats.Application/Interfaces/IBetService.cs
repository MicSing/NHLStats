using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IBetService
{
    Task<BetDto?> GetForMatchAsync(int matchId, string loginId);
    Task<IEnumerable<BetHistoryDto>> GetHistoryAsync(string loginId, int? seasonId);
    Task<(BetDto? Bet, string? Error)> PlaceBetAsync(int matchId, string loginId, CreateBetDto dto);
    Task<(BetDto? Bet, string? Error)> UpdateBetAsync(int matchId, string loginId, UpdateBetDto dto);
    Task<(bool Success, string? Error)> CancelBetAsync(int matchId, string loginId);
    Task EvaluateMatchBetsAsync(int matchId);
}
