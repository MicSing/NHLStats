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

    /// <summary>Raw (unclamped) contribution for one UserMatch entry. Clamp to 0 only at the per-user aggregate level.</summary>
    private static decimal RawEarnings(MoneyConfig config, int totalPlus, int totalMinus) =>
        totalMinus * config.NegativePointValue - totalPlus * config.PositivePointValue;

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
                // Sum raw (unclamped) values per UserMatch to respect per-match rates,
                // then clamp the final total to 0 so plus points in one match can offset
                // minus points in another (avoids double-counting the floor).
                var rawEarnings = g.Sum(um =>
                {
                    var date = um.Match?.MatchDate ?? season?.StartedOn ?? DateTime.MinValue;
                    var config = GetEffectiveConfig(moneyConfigs, date);
                    return config == null ? 0m : RawEarnings(config, um.TotalPlus, um.TotalMinus);
                });
                var earnings = Math.Max(0m, rawEarnings);
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
            .Where(m => m.SeasonId == seasonId && m.MatchDate != null)
            .OrderBy(m => m.MatchDate)
            .ToListAsync();

        // Assign sequential week numbers: each distinct date (day) gets the next number
        var distinctDates = matches
            .Select(m => m.MatchDate!.Value.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        var dateToWeek = distinctDates
            .Select((date, index) => new { date, week = index + 1 })
            .ToDictionary(x => x.date, x => x.week);

        var weeklyMatches = matches.Select(m => new WeeklyMatchDto(
            m.Id,
            dateToWeek[m.MatchDate!.Value.Date],
            m.MatchDate.Value,
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

    // ─── All roster players — goals ───────────────────────────────────────────

    public async Task<IEnumerable<TopRosterPlayerDto>> GetAllGoalScorersAsync(int seasonId)
    {
        var totals = await _db.UserMatchGoals
            .Where(g => g.UserMatch!.SeasonId == seasonId)
            .GroupBy(g => g.RosterPlayerId)
            .Select(g => new { RosterPlayerId = g.Key, Total = g.Sum(x => x.Count) })
            .OrderByDescending(x => x.Total)
            .ToListAsync();

        if (totals.Count == 0) return Enumerable.Empty<TopRosterPlayerDto>();

        var playerIds = totals.Select(t => t.RosterPlayerId).ToList();
        var players = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .Where(rp => playerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

        return totals
            .Where(t => players.ContainsKey(t.RosterPlayerId))
            .Select(t =>
            {
                var p = players[t.RosterPlayerId];
                return new TopRosterPlayerDto(p.Id, p.FirstName, p.Surname, p.Team?.ShortName, t.Total);
            })
            .ToList();
    }

    // ─── All roster players — goals broken down by user ────────────────────────

    public async Task<IEnumerable<RosterScorerByUserDto>> GetAllGoalScorersByUserAsync(int seasonId)
    {
        var rawData = await _db.UserMatchGoals
            .Where(g => g.UserMatch!.SeasonId == seasonId)
            .GroupBy(g => new { g.RosterPlayerId, g.UserMatch!.UserId })
            .Select(g => new { g.Key.RosterPlayerId, g.Key.UserId, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        if (rawData.Count == 0) return Enumerable.Empty<RosterScorerByUserDto>();

        var playerIds = rawData.Select(x => x.RosterPlayerId).Distinct().ToList();
        var userIds = rawData.Select(x => x.UserId).Distinct().ToList();

        var players = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .Where(rp => playerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

        var users = await _db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        return rawData
            .GroupBy(x => x.RosterPlayerId)
            .Where(g => players.ContainsKey(g.Key))
            .Select(g =>
            {
                var p = players[g.Key];
                var totalCount = g.Sum(x => x.Total);
                var userCounts = g
                    .Select(x => new UserGoalCountDto(
                        x.UserId,
                        users.TryGetValue(x.UserId, out var name) ? name : "",
                        x.Total))
                    .OrderByDescending(uc => uc.Count)
                    .ToList();
                return new RosterScorerByUserDto(p.Id, p.FirstName, p.Surname, p.Team?.ShortName, totalCount, userCounts);
            })
            .OrderByDescending(x => x.TotalCount)
            .ToList();
    }

    // ─── All roster players — penalties ──────────────────────────────────────

    public async Task<IEnumerable<TopRosterPlayerDto>> GetAllPenaltyPlayersAsync(int seasonId)
    {
        var totals = await _db.UserMatchPenalties
            .Where(p => p.UserMatch!.SeasonId == seasonId)
            .GroupBy(p => p.RosterPlayerId)
            .Select(g => new { RosterPlayerId = g.Key, Total = g.Sum(x => x.Count) })
            .OrderByDescending(x => x.Total)
            .ToListAsync();

        if (totals.Count == 0) return Enumerable.Empty<TopRosterPlayerDto>();

        var playerIds = totals.Select(t => t.RosterPlayerId).ToList();
        var players = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .Where(rp => playerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

        return totals
            .Where(t => players.ContainsKey(t.RosterPlayerId))
            .Select(t =>
            {
                var p = players[t.RosterPlayerId];
                return new TopRosterPlayerDto(p.Id, p.FirstName, p.Surname, p.Team?.ShortName, t.Total);
            })
            .ToList();
    }

    // ─── All roster players — penalties broken down by user ──────────────────

    public async Task<IEnumerable<RosterPenalizedByUserDto>> GetAllPenaltyPlayersByUserAsync(int seasonId)
    {
        var rawData = await _db.UserMatchPenalties
            .Where(p => p.UserMatch!.SeasonId == seasonId)
            .GroupBy(p => new { p.RosterPlayerId, p.UserMatch!.UserId })
            .Select(g => new { g.Key.RosterPlayerId, g.Key.UserId, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        if (rawData.Count == 0) return Enumerable.Empty<RosterPenalizedByUserDto>();

        var playerIds = rawData.Select(x => x.RosterPlayerId).Distinct().ToList();
        var userIds = rawData.Select(x => x.UserId).Distinct().ToList();

        var players = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .Where(rp => playerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

        var users = await _db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        return rawData
            .GroupBy(x => x.RosterPlayerId)
            .Where(g => players.ContainsKey(g.Key))
            .Select(g =>
            {
                var p = players[g.Key];
                var totalCount = g.Sum(x => x.Total);
                var userCounts = g
                    .Select(x => new UserPenaltyCountDto(
                        x.UserId,
                        users.TryGetValue(x.UserId, out var name) ? name : "",
                        x.Total))
                    .OrderByDescending(uc => uc.Count)
                    .ToList();
                return new RosterPenalizedByUserDto(p.Id, p.FirstName, p.Surname, p.Team?.ShortName, totalCount, userCounts);
            })
            .OrderByDescending(x => x.TotalCount)
            .ToList();
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

        // Payouts per user (all seasons) — loaded into memory to avoid SQLite decimal Sum limitation
        var allPayouts = await _db.UserPayouts.ToListAsync();
        var payoutsByUser = allPayouts
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Sum(p => p.Amount));

        var userEarnings = userMatches
            .GroupBy(um => new { um.UserId, UserName = um.User?.Name ?? "" })
            .Select(g =>
            {
                var totalPlus = g.Sum(um => um.TotalPlus);
                var totalMinus = g.Sum(um => um.TotalMinus);
                var rawEarnings = g.Sum(um =>
                {
                    DateTime date;
                    if (um.Match?.MatchDate != null)
                        date = um.Match.MatchDate.Value;
                    else if (seasons.TryGetValue(um.SeasonId, out var season))
                        date = season.StartedOn;
                    else
                        date = DateTime.MinValue;

                    var config = GetEffectiveConfig(moneyConfigs, date);
                    return config == null ? 0m : RawEarnings(config, um.TotalPlus, um.TotalMinus);
                });
                var paid = payoutsByUser.TryGetValue(g.Key.UserId, out var p) ? p : 0m;
                var remaining = Math.Max(0m, rawEarnings - paid);
                return new UserEarningsDto(g.Key.UserId, g.Key.UserName, totalPlus, totalMinus, rawEarnings, paid, remaining);
            })
            .OrderByDescending(u => u.TotalEarnings)
            .ToList();

        var totalCollected = payoutsByUser.Values.Sum();
        var canBeCollected = userEarnings.Sum(u => u.RemainingBalance);
        var balance = totalCollected - totalExpenses;

        return new AllTimeEarningsDto(userEarnings, totalCollected, canBeCollected, totalExpenses, balance);
    }

    // ─── Per-user goals & penalties totals for a season ──────────────────────

    public async Task<IEnumerable<UserSeasonTotalsDto>> GetUserSeasonTotalsAsync(int seasonId)
    {
        // Load user name lookup
        var users = await _db.Users.ToDictionaryAsync(u => u.Id, u => u.Name);

        // Goals by user
        var goalsByUser = await _db.UserMatchGoals
            .Where(g => g.UserMatch!.SeasonId == seasonId)
            .GroupBy(g => g.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        // Penalties by user
        var penaltiesByUser = await _db.UserMatchPenalties
            .Where(p => p.UserMatch!.SeasonId == seasonId)
            .GroupBy(p => p.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        // Merge by userId
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
}
