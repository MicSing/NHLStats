using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface IBettingOddsService
{
    Task RecalculateForMatchAsync(int matchId);

    /// <summary>Recalculates odds for every not-yet-played match. Returns how many matches were touched.</summary>
    Task<int> RecalculateAllUpcomingAsync();
    Task RecalculateUpcomingAsync(int count = 7);
    Task<MatchOddsDto?> GetMatchOddsAsync(int matchId);
    Task<OccasionsOddsDto?> GetUserEventOddsForOccasionsAsync(int matchId, OddsBetType betType, int userId, int occasions);
}
