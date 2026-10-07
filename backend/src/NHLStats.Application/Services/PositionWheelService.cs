using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

/// <summary>
/// Wheel of fortune that assigns season positions. Season-active players spin in order of
/// their previous-season stats: most minus points, fewest plus points, most penalties,
/// fewest goals. Players without previous-season stats spin last.
/// </summary>
public class PositionWheelService : IPositionWheelService
{
    private static readonly SeasonUserPosition[] AllPositions = Enum.GetValues<SeasonUserPosition>();

    private readonly NhlStatsDbContext _db;

    public PositionWheelService(NhlStatsDbContext db) => _db = db;

    public async Task<PositionWheelStateDto?> GetStateAsync(int seasonId)
    {
        var season = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == seasonId);
        return season == null ? null : await BuildStateAsync(season);
    }

    public async Task<PositionWheelSpinResultDto?> SpinAsync(int seasonId)
    {
        var season = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == seasonId);
        if (season == null) return null;

        var state = await BuildStateAsync(season);
        if (state.CurrentSpinnerUserId is not int spinnerId)
            throw new InvalidOperationException("Every season-active player already has a position.");

        var position = state.AvailablePositions[Random.Shared.Next(state.AvailablePositions.Count)];
        var seasonUser = await _db.SeasonUsers.FirstAsync(su => su.SeasonId == seasonId && su.UserId == spinnerId);
        seasonUser.Position = position;
        await _db.SaveChangesAsync();

        return new PositionWheelSpinResultDto(spinnerId, position, await BuildStateAsync(season));
    }

    public async Task<PositionWheelStateDto?> ResetAsync(int seasonId)
    {
        var season = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == seasonId);
        if (season == null) return null;

        var seasonUsers = await _db.SeasonUsers.Where(su => su.SeasonId == seasonId).ToListAsync();
        foreach (var su in seasonUsers) su.Position = null;
        await _db.SaveChangesAsync();

        return await BuildStateAsync(season);
    }

    private async Task<PositionWheelStateDto> BuildStateAsync(Season season)
    {
        var previous = await FindPreviousMainSeasonAsync(season);
        var stats = previous == null
            ? new Dictionary<int, PreviousStats>()
            : await LoadPreviousStatsAsync(previous.Id);

        var players = await _db.SeasonUsers
            .AsNoTracking()
            .Where(su => su.SeasonId == season.Id && su.IsActive)
            .Select(su => new { su.UserId, su.User!.Name, su.Position })
            .ToListAsync();

        var order = players
            .Select(p =>
            {
                var hasStats = stats.TryGetValue(p.UserId, out var s);
                s ??= new PreviousStats();
                return new PositionWheelEntryDto(
                    p.UserId, p.Name, p.Position, hasStats, s.Minus, s.Plus, s.Penalties, s.Goals);
            })
            .OrderByDescending(e => e.HasPreviousStats)
            .ThenByDescending(e => e.MinusPoints)
            .ThenBy(e => e.PlusPoints)
            .ThenByDescending(e => e.Penalties)
            .ThenBy(e => e.Goals)
            .ThenBy(e => e.Name, StringComparer.InvariantCultureIgnoreCase)
            .ThenBy(e => e.UserId)
            .ToList();

        // Positions stay unique; once all are taken the wheel refills with the least-used ones.
        var taken = AllPositions.ToDictionary(p => p, p => order.Count(e => e.Position == p));
        var minTaken = taken.Values.Min();
        var available = AllPositions.Where(p => taken[p] == minTaken).ToList();

        return new PositionWheelStateDto(
            previous?.Id,
            previous?.Name,
            order,
            order.FirstOrDefault(e => e.Position == null)?.UserId,
            available);
    }

    /// <summary>
    /// Latest main (non-playoff) season started before this one. For a playoff season,
    /// its own parent is skipped and the parent's start date is the reference.
    /// </summary>
    private async Task<Season?> FindPreviousMainSeasonAsync(Season season)
    {
        var referenceDate = season.StartedOn;
        if (season.ParentSeasonId is int parentId)
        {
            var parent = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == parentId);
            if (parent != null) referenceDate = parent.StartedOn;
        }

        return await _db.Seasons
            .AsNoTracking()
            .Where(s => s.ParentSeasonId == null
                && s.Id != season.Id
                && s.Id != season.ParentSeasonId
                && s.StartedOn < referenceDate)
            .OrderByDescending(s => s.StartedOn)
            .ThenByDescending(s => s.Id)
            .FirstOrDefaultAsync();
    }

    /// <summary>Totals for a main season combined with its playoff sub-seasons.</summary>
    private async Task<Dictionary<int, PreviousStats>> LoadPreviousStatsAsync(int previousSeasonId)
    {
        var seasonIds = await _db.Seasons
            .Where(s => s.Id == previousSeasonId || s.ParentSeasonId == previousSeasonId)
            .Select(s => s.Id)
            .ToListAsync();

        var result = new Dictionary<int, PreviousStats>();
        PreviousStats For(int userId) =>
            result.TryGetValue(userId, out var s) ? s : result[userId] = new PreviousStats();

        // Legacy aggregated totals predate match-level tracking; they add to match points.
        var aggregated = await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .Where(a => seasonIds.Contains(a.SeasonId))
            .ToListAsync();
        foreach (var a in aggregated)
        {
            var s = For(a.UserId);
            s.Plus += a.TotalPlus;
            s.Minus += a.TotalMinus;
        }

        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .AsSplitQuery()
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .Where(um => seasonIds.Contains(um.SeasonId))
            .ToListAsync();
        foreach (var um in userMatches)
        {
            var (plus, minus) = StatsCalculationHelpers.GetTotalsFromPoints(um.Points);
            var s = For(um.UserId);
            s.Plus += plus;
            s.Minus += minus;
        }

        var goals = await _db.UserMatchGoals
            .Where(g => seasonIds.Contains(g.UserMatch!.SeasonId) && g.GoalType != GoalType.Shootout)
            .GroupBy(g => g.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Count) })
            .ToListAsync();
        foreach (var g in goals) For(g.UserId).Goals = g.Total;

        var penalties = await _db.UserMatchPenalties
            .Where(p => seasonIds.Contains(p.UserMatch!.SeasonId))
            .GroupBy(p => p.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Count) })
            .ToListAsync();
        foreach (var p in penalties) For(p.UserId).Penalties = p.Total;

        return result;
    }

    private sealed class PreviousStats
    {
        public int Plus { get; set; }
        public int Minus { get; set; }
        public int Penalties { get; set; }
        public int Goals { get; set; }
    }
}
