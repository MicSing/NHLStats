using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public partial class PositionColorService : IPositionColorService
{
    /// <summary>Colours the Collector can look for (keep in sync with collector/nhlcollector/rings.py).</summary>
    public static readonly string[] NamedColors = ["red", "orange", "yellow", "green", "cyan", "blue", "pink"];

    private readonly NhlStatsDbContext _db;

    public PositionColorService(NhlStatsDbContext db) => _db = db;

    public async Task<IReadOnlyList<PositionColorDto>> GetAllAsync()
    {
        var map = await GetMapAsync();
        return Enum.GetValues<SeasonUserPosition>()
            .Select(p => new PositionColorDto(p, map.GetValueOrDefault(p)))
            .ToList();
    }

    public async Task<Dictionary<SeasonUserPosition, string>> GetMapAsync() =>
        await _db.PositionColors.AsNoTracking().ToDictionaryAsync(c => c.Position, c => c.Color);

    public async Task<(IReadOnlyList<PositionColorDto>? colors, string? error)> UpdateAsync(UpdatePositionColorsDto dto)
    {
        var changes = new List<(SeasonUserPosition position, string? color)>();
        foreach (var (key, value) in dto.Colors ?? [])
        {
            if (!Enum.TryParse<SeasonUserPosition>(key, ignoreCase: true, out var position) || !Enum.IsDefined(position))
                return (null, $"Unknown position '{key}'. Use LW, C, RW, LD or RD.");
            var color = Normalize(value);
            if (color == "")
                return (null, $"Unknown colour '{value}'. Use {string.Join(", ", NamedColors)} or #rrggbb.");
            changes.Add((position, color));
        }

        var existing = await _db.PositionColors.ToDictionaryAsync(c => c.Position);
        foreach (var (position, color) in changes)
        {
            existing.TryGetValue(position, out var row);
            if (color == null) { if (row != null) _db.PositionColors.Remove(row); }
            else if (row != null) row.Color = color;
            else _db.PositionColors.Add(new PositionColor { Position = position, Color = color });
        }
        await _db.SaveChangesAsync();
        return (await GetAllAsync(), null);
    }

    /// <summary>null for "clear", "" for invalid, otherwise the colour in lower case.</summary>
    private static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var c = value.Trim().ToLowerInvariant();
        return NamedColors.Contains(c) || HexColor().IsMatch(c) ? c : "";
    }

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexColor();
}
