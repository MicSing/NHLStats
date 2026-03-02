using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IMoneyConfigService
{
    Task<MoneyConfigDto?> GetCurrentAsync();
    Task<IEnumerable<MoneyConfigDto>> GetHistoryAsync();
    /// <summary>
    /// Creates a new config. Returns null with an error message if EffectiveFrom
    /// is not strictly after the most-recent existing entry.
    /// </summary>
    Task<(MoneyConfigDto? Config, string? Error)> CreateAsync(CreateMoneyConfigDto dto);
}
