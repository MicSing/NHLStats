using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IBettingCalculator
{
    Task<UserBettingData?> LoadForLoginAsync(string loginId);

    Task<IReadOnlyDictionary<int, UserBettingData>> LoadForUsersAsync(
        IReadOnlyCollection<int> matchIds,
        bool allTimeBets,
        IReadOnlyDictionary<int, int>? aggregatedPlusByUser = null,
        IReadOnlyDictionary<int, int>? aggregatedMinusByUser = null);

    BettingBreakdown Compute(UserBettingData data);
}
