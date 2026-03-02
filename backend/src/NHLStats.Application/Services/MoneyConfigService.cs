using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class MoneyConfigService : IMoneyConfigService
{
    private readonly NhlStatsDbContext _db;

    public MoneyConfigService(NhlStatsDbContext db) => _db = db;

    private static MoneyConfigDto ToDto(MoneyConfig m) =>
        new(m.Id, m.NegativePointValue, m.PositivePointValue, m.EffectiveFrom);

    public async Task<MoneyConfigDto?> GetCurrentAsync()
    {
        var config = await _db.MoneyConfigs
            .OrderByDescending(m => m.EffectiveFrom)
            .FirstOrDefaultAsync();
        return config == null ? null : ToDto(config);
    }

    public async Task<IEnumerable<MoneyConfigDto>> GetHistoryAsync() =>
        await _db.MoneyConfigs
            .OrderByDescending(m => m.EffectiveFrom)
            .Select(m => ToDto(m))
            .ToListAsync();

    public async Task<(MoneyConfigDto? Config, string? Error)> CreateAsync(CreateMoneyConfigDto dto)
    {
        var latest = await _db.MoneyConfigs
            .OrderByDescending(m => m.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (latest != null && dto.EffectiveFrom <= latest.EffectiveFrom)
            return (null, $"EffectiveFrom must be after the current latest date ({latest.EffectiveFrom:yyyy-MM-dd}).");

        var config = new MoneyConfig
        {
            NegativePointValue = dto.NegativePointValue,
            PositivePointValue = dto.PositivePointValue,
            EffectiveFrom = dto.EffectiveFrom
        };
        _db.MoneyConfigs.Add(config);
        await _db.SaveChangesAsync();
        return (ToDto(config), null);
    }
}
