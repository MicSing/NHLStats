using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class SeasonStatsService : ISeasonStatsService
{
    private readonly NhlStatsDbContext _db;

    public SeasonStatsService(NhlStatsDbContext db)
    {
        _db = db;
    }

    public async Task<IEnumerable<SeasonPointsStatsSummaryDto>> FetchSeasonPointsStatisticsAsync(MatchPhase? phase = null)
    {
        var userMatchesQuery = _db.UserMatches
            .AsNoTracking()
            .AsSplitQuery()
            .Include(um => um.User)
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .AsQueryable();

        if (phase.HasValue)
            userMatchesQuery = userMatchesQuery.Where(um => um.Match != null && um.Match.Phase == phase.Value);

        var userMatches = await userMatchesQuery.ToListAsync();

        // Legacy aggregated totals predate match-level phase tracking, so they only
        // represent regular-season play and never contribute to a Playoff-only filter.
        var aggregatedData = phase == MatchPhase.Playoff
            ? new List<UserSeasonAggregatedData>()
            : await _db.UserSeasonAggregatedData
                .AsNoTracking()
                .ToListAsync();

        // Merge both sources by (season, user) so either source can contribute independently.
        var mergedBySeasonAndUser = new Dictionary<(int SeasonId, int UserId), (int TotalPlus, int TotalMinus)>();

        foreach (var item in aggregatedData)
        {
            var key = (item.SeasonId, item.UserId);
            mergedBySeasonAndUser[key] = (item.TotalPlus, item.TotalMinus);
        }

        foreach (var userMatch in userMatches)
        {
            var key = (userMatch.SeasonId, userMatch.UserId);
            if (!mergedBySeasonAndUser.TryGetValue(key, out var current))
            {
                current = (0, 0);
            }

            var totals = StatsCalculationHelpers.GetTotalsFromPoints(userMatch.Points);

            mergedBySeasonAndUser[key] = (
                current.TotalPlus + totals.plus,
                current.TotalMinus + totals.minus);
        }

        return mergedBySeasonAndUser
            .GroupBy(x => x.Key.SeasonId)
            .Select(g => new SeasonPointsStatsSummaryDto(
                g.Key,
                g.Select(x => new UserPointsMetricsDto(
                        x.Key.UserId,
                        x.Value.TotalPlus,
                        x.Value.TotalMinus))
                    .OrderByDescending(s => s.UserId)
                    .ToList()))
            .OrderBy(x => x.SeasonId)
            .ToList();
    }

    public async Task<IEnumerable<SeasonGoalsStatsSummaryDto>> FetchSeasonGoalStatisicsAsync(MatchPhase? phase = null)
    {
        var goalsByUserAndSeason = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch != null && (!phase.HasValue || (g.UserMatch.Match != null && g.UserMatch.Match.Phase == phase.Value)) && g.GoalType != GoalType.Shootout)
            .GroupBy(g => new { g.UserMatch!.SeasonId, g.UserMatch.UserId })
            .Select(g => new { g.Key.SeasonId, g.Key.UserId, TotalGoals = g.Sum(x => x.Count) })
            .ToListAsync();

        return goalsByUserAndSeason
            .GroupBy(x => x.SeasonId)
            .Select(g => new SeasonGoalsStatsSummaryDto(
                g.Key,
                g.Select(x => new UserGoalsMetricsDto(x.UserId, x.TotalGoals))
                    .OrderByDescending(s => s.UserId)
                    .ToList()))
            .OrderBy(x => x.SeasonId)
            .ToList();
    }

    public async Task<IEnumerable<SeasonPenaltiesStatsSummaryDto>> FetchSeasonPenaltyStatisticsAsync(MatchPhase? phase = null)
    {
        var penaltiesByUserAndSeason = await _db.UserMatchPenalties
            .AsNoTracking()
            .Where(p => p.UserMatch != null && (!phase.HasValue || (p.UserMatch.Match != null && p.UserMatch.Match.Phase == phase.Value)))
            .GroupBy(p => new { p.UserMatch!.SeasonId, p.UserMatch.UserId })
            .Select(g => new { g.Key.SeasonId, g.Key.UserId, TotalPenalties = g.Sum(x => x.Count) })
            .ToListAsync();

        return penaltiesByUserAndSeason
            .GroupBy(x => x.SeasonId)
            .Select(g => new SeasonPenaltiesStatsSummaryDto(
                g.Key,
                g.Select(x => new UserPenaltiesMetricsDto(x.UserId, x.TotalPenalties))
                    .OrderByDescending(s => s.UserId)
                    .ToList()))
            .OrderBy(x => x.SeasonId)
            .ToList();
    }

    public async Task<IEnumerable<UserSeasonTotalsDto>> GetUserSeasonTotalsAsync(int seasonId)
    {
        var users = await _db.Users.ToDictionaryAsync(u => u.Id, u => u.Name);

        var goalsByUser = await _db.UserMatchGoals
            .Where(g => g.UserMatch!.SeasonId == seasonId && g.GoalType != GoalType.Shootout)
            .GroupBy(g => g.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        var penaltiesByUser = await _db.UserMatchPenalties
            .Where(p => p.UserMatch!.SeasonId == seasonId)
            .GroupBy(p => p.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        var allUserIds = goalsByUser.Select(g => g.UserId)
            .Union(penaltiesByUser.Select(p => p.UserId))
            .Distinct();

        var goalsLookup = goalsByUser.ToDictionary(g => g.UserId, g => g.Total);
        var penaltiesLookup = penaltiesByUser.ToDictionary(p => p.UserId, p => p.Total);

        return allUserIds
            .Select(uid => new UserSeasonTotalsDto(
                uid,
                users.TryGetValue(uid, out var name) ? name : "",
                goalsLookup.TryGetValue(uid, out var g) ? g : 0,
                penaltiesLookup.TryGetValue(uid, out var p) ? p : 0))
            .OrderBy(t => t.UserName)
            .ToList();
    }

    public async Task<IEnumerable<UserPointsMetricsDto>> GetAllTimeStatsAsync(IEnumerable<SeasonPointsStatsSummaryDto> seasonsStats)
    {
        var userTotals = seasonsStats
            .SelectMany(s => s.UserStats)
            .GroupBy(us => us.UserId)
            .Select(g =>
            {
                var totalPlus = g.Sum(us => us.TotalPlus);
                var totalMinus = g.Sum(us => us.TotalMinus);
                return new UserPointsMetricsDto(g.Key, totalPlus, totalMinus);
            })
            .OrderByDescending(u => u.UserId)
            .ToList();

        return userTotals;
    }
}
