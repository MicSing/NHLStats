using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface IBettingOddsService
{
    Task RecalculateForMatchAsync(int matchId);
    Task RecalculateAllUpcomingAsync();
    Task<MatchOddsDto?> GetMatchOddsAsync(int matchId);
    Task<OccasionsOddsDto?> GetUserEventOddsForOccasionsAsync(int matchId, OddsBetType betType, int userId, int occasions);
}
