using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IMatchupService
{
    /// <summary>
    /// Returns the matchup summary of the two teams of the given match within its season,
    /// or null when the match does not exist.
    /// </summary>
    Task<MatchupDto?> GetForMatchAsync(int matchId, int lastMatchesCount = 5);
}
