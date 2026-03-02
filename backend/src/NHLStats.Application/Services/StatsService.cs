using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class StatsService : IStatsService
{
    private readonly NhlStatsDbContext _db;

    public StatsService(NhlStatsDbContext db) => _db = db;

    // ─── Money calculation helper ─────────────────────────────────────────────

    /// <summary>
    /// Returns the MoneyConfig active at <paramref name="date"/>.
    /// Uses the latest config whose EffectiveFrom &lt;= date.
    /// Falls back to the earliest config if date precedes all configs.
    /// </summary>
    private static MoneyConfig? GetEffectiveConfig(IReadOnlyList<MoneyConfig> configs, DateTime date)
    {
        if (configs.Count == 0) return null;

        // Latest config whose EffectiveFrom is on or before the match date
        var active = configs
            .Where(m => m.EffectiveFrom <= date)
            .OrderByDescending(m => m.EffectiveFrom)
            .FirstOrDefault();

        // Fallback: date is before any config — use the earliest one
        return active ?? configs.OrderBy(m => m.EffectiveFrom).First();
    }

    private static decimal CalculateEarnings(MoneyConfig config, int totalPlus, int totalMinus) =>
        totalPlus * config.PositivePointValue + totalMinus * config.NegativePointValue;

    // ─── Season stats ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<UserSeasonStatsDto>> GetSeasonStatsAsync(int seasonId)
    {
        var season = await _db.Seasons.FindAsync(seasonId);

        var userMatches = await _db.UserMatches
            .Include(um => um.User)
            .Include(um => um.Match)
            .Where(um => um.SeasonId == seasonId)
            .ToListAsync();

        var moneyConfigs = await _db.MoneyConfigs
            .OrderBy(m => m.EffectiveFrom)
            .ToListAsync();

        return userMatches
            .GroupBy(um => new { um.UserId, UserName = um.User?.Name ?? "" })
            .Select(g =>
            {
                var totalPlus = g.Sum(um => um.TotalPlus);
                var totalMinus = g.Sum(um => um.TotalMinus);
                var earnings = g.Sum(um =>
                {
                    // For specific matches use MatchDate; for aggregated entries use SeasonStartedOn
                    var date = um.Match?.MatchDate ?? season?.StartedOn ?? DateTime.MinValue;
                    var config = GetEffectiveConfig(moneyConfigs, date);
                    return config == null ? 0m : CalculateEarnings(config, um.TotalPlus, um.TotalMinus);
                });
                return new UserSeasonStatsDto(g.Key.UserId, g.Key.UserName, totalPlus, totalMinus, earnings);
            })
            .OrderByDescending(s => s.Earnings)
            .ToList();
    }

    // ─── Weekly match grouping ────────────────────────────────────────────────

    public async Task<IEnumerable<WeekGroupDto>> GetMatchesGroupedByWeekAsync(int seasonId)
    {
        var matches = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => m.SeasonId == seasonId)
            .OrderBy(m => m.MatchDate)
            .ToListAsync();

        // Assign sequential week numbers: each distinct date (day) gets the next number
        var distinctDates = matches
            .Select(m => m.MatchDate.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        var dateToWeek = distinctDates
            .Select((date, index) => new { date, week = index + 1 })
            .ToDictionary(x => x.date, x => x.week);

        var weeklyMatches = matches.Select(m => new WeeklyMatchDto(
            m.Id,
            dateToWeek[m.MatchDate.Date],
            m.MatchDate,
            m.HomeTeamId,
            m.HomeTeam?.Name,
            m.AwayTeamId,
            m.AwayTeam?.Name,
            m.HomeScore,
            m.AwayScore));

        return weeklyMatches
            .GroupBy(m => m.WeekNumber)
            .OrderBy(g => g.Key)
            .Select(g => new WeekGroupDto(g.Key, g.ToList()))
            .ToList();
    }

    // ─── Top roster player — goals ────────────────────────────────────────────

    public async Task<TopRosterPlayerDto?> GetTopGoalScorerAsync(int seasonId)
    {
        // Step 1: aggregate counts by player using a translatable query
        var top = await _db.UserMatchGoals
            .Where(g => g.UserMatch!.SeasonId == seasonId)
            .GroupBy(g => g.RosterPlayerId)
            .Select(g => new { RosterPlayerId = g.Key, Total = g.Sum(x => x.Count) })
            .OrderByDescending(x => x.Total)
            .FirstOrDefaultAsync();

        if (top == null) return null;

        // Step 2: load player details (separate query avoids Include-inside-GroupBy issues)
        var player = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .FirstOrDefaultAsync(rp => rp.Id == top.RosterPlayerId);

        return player == null ? null :
            new TopRosterPlayerDto(player.Id, player.FirstName, player.Surname,
                player.Team?.ShortName, top.Total);
    }

    // ─── Top roster player — penalties ───────────────────────────────────────

    public async Task<TopRosterPlayerDto?> GetTopPenaltyPlayerAsync(int seasonId)
    {
        // Step 1: aggregate counts by player using a translatable query
        var top = await _db.UserMatchPenalties
            .Where(p => p.UserMatch!.SeasonId == seasonId)
            .GroupBy(p => p.RosterPlayerId)
            .Select(g => new { RosterPlayerId = g.Key, Total = g.Sum(x => x.Count) })
            .OrderByDescending(x => x.Total)
            .FirstOrDefaultAsync();

        if (top == null) return null;

        // Step 2: load player details
        var player = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .FirstOrDefaultAsync(rp => rp.Id == top.RosterPlayerId);

        return player == null ? null :
            new TopRosterPlayerDto(player.Id, player.FirstName, player.Surname,
                player.Team?.ShortName, top.Total);
    }

    // ─── All-time earnings ────────────────────────────────────────────────────

    public async Task<AllTimeEarningsDto> GetAllTimeEarningsAsync()
    {
        // Load user matches with user and match navigation (Season loaded separately)
        var userMatches = await _db.UserMatches
            .Include(um => um.User)
            .Include(um => um.Match)
            .ToListAsync();

        // Load seasons separately and build a lookup by Id for aggregated entries
        var seasonIds = userMatches.Where(um => um.Match == null)
            .Select(um => um.SeasonId)
            .Distinct()
            .ToList();
        var seasons = seasonIds.Count > 0
            ? await _db.Seasons
                .Where(s => seasonIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id)
            : new Dictionary<int, NHLStats.Domain.Entities.Season>();

        var moneyConfigs = await _db.MoneyConfigs
            .OrderBy(m => m.EffectiveFrom)
            .ToListAsync();

        var totalExpenses = (decimal)(await _db.Expenses
            .SumAsync(e => (double?)e.Amount) ?? 0.0);

        var userEarnings = userMatches
            .GroupBy(um => new { um.UserId, UserName = um.User?.Name ?? "" })
            .Select(g =>
            {
                var totalPlus = g.Sum(um => um.TotalPlus);
                var totalMinus = g.Sum(um => um.TotalMinus);
                var earnings = g.Sum(um =>
                {
                    DateTime date;
                    if (um.Match != null)
                        date = um.Match.MatchDate;
                    else if (seasons.TryGetValue(um.SeasonId, out var season))
                        date = season.StartedOn;
                    else
                        date = DateTime.MinValue;

                    var config = GetEffectiveConfig(moneyConfigs, date);
                    return config == null ? 0m : CalculateEarnings(config, um.TotalPlus, um.TotalMinus);
                });
                return new UserEarningsDto(g.Key.UserId, g.Key.UserName, totalPlus, totalMinus, earnings);
            })
            .OrderByDescending(u => u.TotalEarnings)
            .ToList();

        var totalCollected = userEarnings.Sum(u => u.TotalEarnings);
        var balance = totalCollected - totalExpenses;

        return new AllTimeEarningsDto(userEarnings, totalCollected, totalExpenses, balance);
    }
}
