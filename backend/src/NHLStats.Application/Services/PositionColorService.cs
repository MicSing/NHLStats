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

    public async Task<IReadOnlyList<MatchUserColorDto>?> GetMatchColorsAsync(int matchId)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return null;

        var defaults = await GetMapAsync();
        var seasonUsers = await _db.SeasonUsers.AsNoTracking()
            .Where(su => su.SeasonId == match.SeasonId)
            .ToDictionaryAsync(su => su.UserId);
        var userMatches = await _db.UserMatches.AsNoTracking()
            .Where(um => um.MatchId == matchId)
            .Select(um => new { um.UserId, um.User!.Name, um.Color })
            .ToListAsync();

        return userMatches
            .DistinctBy(um => um.UserId)
            .OrderBy(um => um.Name)
            .Select(um =>
            {
                seasonUsers.TryGetValue(um.UserId, out var su);
                var positionColor = su?.Position is { } p ? defaults.GetValueOrDefault(p) : null;
                var seasonColor = su?.Color ?? positionColor;
                var (color, source) = um.Color != null ? (um.Color, "match")
                    : su?.Color != null ? (su.Color, "season")
                    : positionColor != null ? (positionColor, "position")
                    : ((string?)null, (string?)null);
                return new MatchUserColorDto(um.UserId, um.Name, su?.Position, color, source, seasonColor);
            })
            .ToList();
    }

    public async Task<(IReadOnlyList<MatchUserColorDto>? colors, string? error)> SetMatchColorAsync(int matchId, int userId, string? color)
    {
        var normalized = Normalize(color);
        if (normalized == "")
            return (null, $"Unknown colour '{color}'. Use {string.Join(", ", NamedColors)} or #rrggbb.");
        var rows = await _db.UserMatches.Where(um => um.MatchId == matchId && um.UserId == userId).ToListAsync();
        if (rows.Count == 0) return (null, null);
        foreach (var um in rows) um.Color = normalized;
        await _db.SaveChangesAsync();
        return (await GetMatchColorsAsync(matchId), null);
    }

    /// <summary>null for "clear", "" for invalid, otherwise the colour in lower case.</summary>
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var c = value.Trim().ToLowerInvariant();
        return NamedColors.Contains(c) || HexColor().IsMatch(c) ? c : "";
    }

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexColor();
}
