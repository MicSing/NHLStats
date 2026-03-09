using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IBetService
{
    Task<BetDto?> GetForMatchAsync(int matchId, string loginId);
    Task<(BetDto? Bet, string? Error)> CreateForMatchAsync(int seasonId, int matchId, string loginId, CreateBetDto dto);
    Task<(BetDto? Bet, string? Error)> UpdateForMatchAsync(int seasonId, int matchId, string loginId, UpdateBetDto dto);
    Task<bool> DeleteForMatchAsync(int seasonId, int matchId, string loginId);
    Task<bool> DeleteByIdAsync(Guid id, string loginId);
}
