using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IPositionWheelService
{
    /// <summary>Returns null when the season does not exist.</summary>
    Task<PositionWheelStateDto?> GetStateAsync(int seasonId);

    /// <summary>
    /// Assigns a random available position to the current spinner.
    /// Returns null when the season does not exist; throws <see cref="InvalidOperationException"/>
    /// when nobody is left to spin.
    /// </summary>
    Task<PositionWheelSpinResultDto?> SpinAsync(int seasonId);

    /// <summary>Clears the positions of all season users. Returns null when the season does not exist.</summary>
    Task<PositionWheelStateDto?> ResetAsync(int seasonId);
}
