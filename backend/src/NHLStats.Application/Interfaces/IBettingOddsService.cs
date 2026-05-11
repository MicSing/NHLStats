using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IBettingOddsService
{
    Task RecalculateForMatchAsync(int matchId);
    Task RecalculateAllUpcomingAsync();
    Task<MatchOddsDto?> GetMatchOddsAsync(int matchId);
}
