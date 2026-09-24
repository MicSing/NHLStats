using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

/// <summary>
/// Tracks background odds calculations for newly generated matches so admins can see when
/// the betting odds for those matches are still being computed.
/// </summary>
public interface IOddsRecalculationTracker
{
    void MarkQueued(int seasonId, IEnumerable<int> matchIds);
    void MarkRunning(int matchId);
    void MarkDone(int matchId);
    void MarkFailed(int matchId, string error);
    OddsRecalculationStatusDto GetSeasonStatus(int seasonId);
}
