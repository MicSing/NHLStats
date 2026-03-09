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

    private static (int plus, int minus) GetTotalsFromPoints(IEnumerable<UserMatchPoint> points)
    {
        var plus = points
            .Where(p => p.PointReason != null && p.PointReason.IsPositive)
            .Sum(p => p.Count);
        var minus = points
            .Where(p => p.PointReason != null && !p.PointReason.IsPositive)
            .Sum(p => p.Count);
        return (plus, minus);
    }

    // ─── Season stats ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<SeasonPointsStatsSummaryDto>> FetchSeasonPointsStatisticsAsync()
    {
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .AsSplitQuery()
            .Include(um => um.User)
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .ToListAsync();

        var aggregatedData = await _db.UserSeasonAggregatedData
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

            var totals = GetTotalsFromPoints(userMatch.Points);

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

    public async Task<IEnumerable<SeasonGoalsStatsSummaryDto>> FetchSeasonGoalStatisicsAsync()
    {
        var goalsByUserAndSeason = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch != null)
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

    public async Task<IEnumerable<SeasonPenaltiesStatsSummaryDto>> FetchSeasonPenaltyStatisticsAsync()
    {
        var penaltiesByUserAndSeason = await _db.UserMatchPenalties
            .AsNoTracking()
            .Where(p => p.UserMatch != null)
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

    // ─── Weekly match grouping ────────────────────────────────────────────────

    public async Task<IEnumerable<WeekGroupDto>> GetMatchesGroupedByWeekAsync(int seasonId)
    {
        var matches = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => m.SeasonId == seasonId && m.MatchDate != null)
            .OrderBy(m => m.MatchDate)
            .ToListAsync();

        if (matches.Count == 0)
        {
            return new List<WeekGroupDto>();
        }

        // Assign sequential week numbers: each distinct date (day) gets the next number
        var distinctDates = matches
            .Select(m => m.MatchDate!.Value.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        var dateToWeek = distinctDates
            .Select((date, index) => new { date, week = index + 1 })
            .ToDictionary(x => x.date, x => x.week);

        var matchIdToWeek = matches
            .ToDictionary(m => m.Id, m => dateToWeek[m.MatchDate!.Value.Date]);

        var matchIds = matchIdToWeek.Keys.ToList();

        var pointRows = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.UserMatch != null && matchIds.Contains(p.UserMatch.MatchId))
            .Select(p => new
            {
                MatchId = p.UserMatch!.MatchId,
                p.Count,
                IsPositive = p.PointReason != null && p.PointReason.IsPositive
            })
            .ToListAsync();

        var totalsByWeek = new Dictionary<int, (int plus, int minus)>();

        foreach (var row in pointRows)
        {
            if (!matchIdToWeek.TryGetValue(row.MatchId, out var week))
            {
                continue;
            }

            if (!totalsByWeek.TryGetValue(week, out var totals))
            {
                totals = (0, 0);
            }

            if (row.IsPositive)
            {
                totals.plus += row.Count;
            }
            else
            {
                totals.minus += row.Count;
            }

            totalsByWeek[week] = totals;
        }

        var weeklyMatches = matches.Select(m => new WeeklyMatchDto(
            m.Id,
            dateToWeek[m.MatchDate!.Value.Date],
            m.MatchDate.Value,
            m.HomeTeamId,
            m.HomeTeam?.Name,
            m.HomeTeam?.ShortName,
            m.AwayTeamId,
            m.AwayTeam?.Name,
            m.AwayTeam?.ShortName,
            m.HomeScore,
            m.AwayScore,
            m.CompletionType));

        return weeklyMatches
            .GroupBy(m => m.WeekNumber)
            .OrderByDescending(g => g.Key)
            .Select(g =>
            {
                var totals = totalsByWeek.TryGetValue(g.Key, out var value)
                    ? value
                    : (plus: 0, minus: 0);
                var orderedMatches = g
                    .OrderByDescending(m => m.MatchDate)
                    .ToList();
                return new WeekGroupDto(g.Key, totals.plus, totals.minus, orderedMatches);
            })
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

    public async Task<IEnumerable<SeasonTopRosterPlayersDto>> GetTopRosterPlayersAsync()
    {
        // Step 1: Query each table once and aggregate all needed counters
        var goalsBySeasonAndPlayer = await _db.UserMatchGoals
            .Where(g => g.UserMatch != null)
            .GroupBy(g => new { g.UserMatch!.SeasonId, g.RosterPlayerId })
            .Select(g => new
            {
                g.Key.SeasonId,
                g.Key.RosterPlayerId,
                TotalGoals = g.Sum(x => x.Count),
                TotalPpGoals = g.Where(x => x.GoalType == GoalType.PowerPlay).Sum(x => x.Count),
                TotalShGoals = g.Where(x => x.GoalType == GoalType.ShortHanded).Sum(x => x.Count)
            })
            .ToListAsync();

        var topPenaltyPlayersBySeasonRaw = await _db.UserMatchPenalties
            .Where(p => p.UserMatch != null)
            .GroupBy(p => new { p.UserMatch!.SeasonId, p.RosterPlayerId })
            .Select(g => new { g.Key.SeasonId, g.Key.RosterPlayerId, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        // Step 2: Find top player per season (in-memory grouping on small result sets)
        var topScorersBySeason = goalsBySeasonAndPlayer
            .GroupBy(x => x.SeasonId)
            .Select(g => g.OrderByDescending(x => x.TotalGoals).First())
            .ToList();

        var topPpScorersBySeason = goalsBySeasonAndPlayer
            .Where(x => x.TotalPpGoals > 0)
            .GroupBy(x => x.SeasonId)
            .Select(g => g.OrderByDescending(x => x.TotalPpGoals).First())
            .ToList();

        var topShScorersBySeason = goalsBySeasonAndPlayer
            .Where(x => x.TotalShGoals > 0)
            .GroupBy(x => x.SeasonId)
            .Select(g => g.OrderByDescending(x => x.TotalShGoals).First())
            .ToList();

        var topPenaltyPlayersBySeason = topPenaltyPlayersBySeasonRaw
            .GroupBy(x => x.SeasonId)
            .Select(g => g.OrderByDescending(x => x.Total).First())
            .ToList();

        // Step 3: Collect all unique player IDs and load player details once
        var allPlayerIds = topScorersBySeason.Select(x => x.RosterPlayerId)
            .Union(topPpScorersBySeason.Select(x => x.RosterPlayerId))
            .Union(topShScorersBySeason.Select(x => x.RosterPlayerId))
            .Union(topPenaltyPlayersBySeasonRaw.Select(x => x.RosterPlayerId))
            .Union(topPenaltyPlayersBySeason.Select(x => x.RosterPlayerId))
            .ToList();

        var players = await _db.RosterPlayers
            .Where(rp => allPlayerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

        // Step 4: Build DTOs per season
        var allSeasonIds = topScorersBySeason.Select(x => x.SeasonId)
            .Union(topPpScorersBySeason.Select(x => x.SeasonId))
            .Union(topShScorersBySeason.Select(x => x.SeasonId))
            .Union(topPenaltyPlayersBySeason.Select(x => x.SeasonId))
            .Distinct()
            .OrderBy(id => id);

        var result = allSeasonIds.Select(seasonId =>
        {
            var topScorer = topScorersBySeason.FirstOrDefault(x => x.SeasonId == seasonId);
            var topPpScorer = topPpScorersBySeason.FirstOrDefault(x => x.SeasonId == seasonId);
            var topShScorer = topShScorersBySeason.FirstOrDefault(x => x.SeasonId == seasonId);
            var topPenalty = topPenaltyPlayersBySeason.FirstOrDefault(x => x.SeasonId == seasonId);

            PlayerTopStatsDto? topScorerDto = null;
            if (topScorer != null && players.TryGetValue(topScorer.RosterPlayerId, out var scorerPlayer))
            {
                topScorerDto = new PlayerTopStatsDto(
                    $"{scorerPlayer.FirstName} {scorerPlayer.Surname}",
                    topScorer.TotalGoals);
            }

            PlayerTopStatsDto? topPpScorerDto = null;
            if (topPpScorer != null && players.TryGetValue(topPpScorer.RosterPlayerId, out var ppPlayer))
            {
                topPpScorerDto = new PlayerTopStatsDto(
                    $"{ppPlayer.FirstName} {ppPlayer.Surname}",
                    topPpScorer.TotalPpGoals);
            }

            PlayerTopStatsDto? topShScorerDto = null;
            if (topShScorer != null && players.TryGetValue(topShScorer.RosterPlayerId, out var shPlayer))
            {
                topShScorerDto = new PlayerTopStatsDto(
                    $"{shPlayer.FirstName} {shPlayer.Surname}",
                    topShScorer.TotalShGoals);
            }

            PlayerTopStatsDto? topPenaltyDto = null;
            if (topPenalty != null && players.TryGetValue(topPenalty.RosterPlayerId, out var penaltyPlayer))
            {
                topPenaltyDto = new PlayerTopStatsDto(
                    $"{penaltyPlayer.FirstName} {penaltyPlayer.Surname}",
                    topPenalty.Total);
            }

            return new SeasonTopRosterPlayersDto(
                seasonId,
                topScorerDto,
                topPenaltyDto,
                topPpScorerDto,
                topShScorerDto);
        }).ToList();

        return result;
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

    public async Task<IEnumerable<RosterScorerBySeasonDto>> GetAllGoalScorersByUserAsync()
    {
        var rawData = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch != null)
            .GroupBy(g => new { g.RosterPlayerId, g.UserMatch!.UserId, g.UserMatch.SeasonId })
            .Select(g => new { g.Key.RosterPlayerId, g.Key.UserId, g.Key.SeasonId, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        if (rawData.Count == 0) return Enumerable.Empty<RosterScorerBySeasonDto>();

        var playerIds = rawData.Select(x => x.RosterPlayerId).Distinct().ToList();
        var userIds = rawData.Select(x => x.UserId).Distinct().ToList();
        var seasonIds = rawData.Select(x => x.SeasonId).Distinct().ToList();

        var players = await _db.RosterPlayers
            .AsNoTracking()
            .Include(rp => rp.Team)
            .Where(rp => playerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        return rawData
            .GroupBy(x => new { x.RosterPlayerId, x.SeasonId })
            .Where(g => players.ContainsKey(g.Key.RosterPlayerId))
            .Select(g =>
            {
                var p = players[g.Key.RosterPlayerId];
                var totalCount = g.Sum(x => x.Total);
                var userCounts = g
                    .Select(x => new UserGoalCountDto(
                        x.UserId,
                        users.TryGetValue(x.UserId, out var name) ? name : "",
                        x.Total))
                    .OrderByDescending(uc => uc.Count)
                    .ToList();
                return new RosterScorerBySeasonDto(p.Id, g.Key.SeasonId, p.FirstName, p.Surname, totalCount, userCounts);
            })
            .OrderByDescending(x => x.TotalCount)
            .ToList();
    }

    public async Task<IEnumerable<AllTimeRosterScorerDto>> GetAllTimeRosterScorerAsync(IEnumerable<RosterScorerBySeasonDto> rosterScorers)
    {
        var aggregated = rosterScorers
            .GroupBy(r => r.RosterPlayerId)
            .Select(g =>
            {
                var totalCount = g.Sum(r => r.TotalCount);
                var userCounts = g.SelectMany(r => r.UserCounts)
                    .GroupBy(uc => uc.UserId)
                    .Select(ucg =>
                    {
                        var userTotal = ucg.Sum(uc => uc.Count);
                        return new UserGoalCountDto(ucg.Key, ucg.First().UserName, userTotal);
                    })
                    .OrderByDescending(uc => uc.Count)
                    .ToList();

                var first = g.First();
                return new AllTimeRosterScorerDto(first.RosterPlayerId, first.FirstName, first.Surname, totalCount, userCounts);
            })
            .OrderByDescending(r => r.TotalCount)
            .ToList();

        return aggregated;
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

    public async Task<IEnumerable<RosterPenalizedBySeasonDto>> GetAllPenaltyPlayersByUserAsync()
    {
        var rawData = await _db.UserMatchPenalties
            .AsNoTracking()
            .Where(g => g.UserMatch != null)
            .GroupBy(g => new { g.RosterPlayerId, g.UserMatch!.UserId, g.UserMatch.SeasonId })
            .Select(g => new { g.Key.RosterPlayerId, g.Key.UserId, g.Key.SeasonId, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        if (rawData.Count == 0) return Enumerable.Empty<RosterPenalizedBySeasonDto>();

        var playerIds = rawData.Select(x => x.RosterPlayerId).Distinct().ToList();
        var userIds = rawData.Select(x => x.UserId).Distinct().ToList();
        var seasonIds = rawData.Select(x => x.SeasonId).Distinct().ToList();

        var players = await _db.RosterPlayers
            .AsNoTracking()
            .Include(rp => rp.Team)
            .Where(rp => playerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        return rawData
            .GroupBy(x => new { x.RosterPlayerId, x.SeasonId })
            .Where(g => players.ContainsKey(g.Key.RosterPlayerId))
            .Select(g =>
            {
                var p = players[g.Key.RosterPlayerId];
                var totalCount = g.Sum(x => x.Total);
                var userCounts = g
                    .Select(x => new UserPenaltyCountDto(
                        x.UserId,
                        users.TryGetValue(x.UserId, out var name) ? name : "",
                        x.Total))
                    .OrderByDescending(uc => uc.Count)
                    .ToList();
                return new RosterPenalizedBySeasonDto(p.Id, g.Key.SeasonId, p.FirstName, p.Surname, totalCount, userCounts);
            })
            .OrderByDescending(x => x.TotalCount)
            .ToList();
    }

    public async Task<IEnumerable<AllTimeRosterPenalizedDto>> GetAllTimePenaltyPlayersByUserAsync(IEnumerable<RosterPenalizedBySeasonDto> seasonData)
    {
        var groupedData = seasonData
            .GroupBy(x => x.RosterPlayerId)
            .Select(g =>
            {
                var totalCount = g.Sum(x => x.TotalCount);
                var userCounts = g
                    .SelectMany(x => x.UserCounts)
                    .GroupBy(uc => uc.UserId)
                    .Select(ucg => new UserPenaltyCountDto(
                        ucg.Key,
                        ucg.First().UserName,
                        ucg.Sum(uc => uc.Count)))
                    .OrderByDescending(uc => uc.Count)
                    .ToList();
                var first = g.First();
                return new AllTimeRosterPenalizedDto(first.RosterPlayerId, first.FirstName, first.Surname, totalCount, userCounts);
            })
            .OrderByDescending(x => x.TotalCount)
            .ToList();

        return groupedData;
    }

    // ─── All-seasons aggregated plus/minus ────────────────────────────────────

    public async Task<IEnumerable<UserPointsMetricsDto>> GetAllTimeStatsAsync(IEnumerable<SeasonPointsStatsSummaryDto> seasonsStats)
    {
        // Aggregate per-user totals across all seasons
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

    // ─── Plus/minus trend per season ──────────────────────────────────────────

    public async Task<IEnumerable<PeriodPlusMinusDto>> GetAllTimePlusMinusTrendAsync()
    {
        var allSeasons = await _db.Seasons
            .AsNoTracking()
            .Include(s => s.SeasonUsers).ThenInclude(su => su.User)
            .OrderBy(s => s.StartedOn)
            .ToListAsync();

        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .ToListAsync();

        var aggregatedData = await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .ToListAsync();

        var totalMatches = await _db.Matches
            .AsNoTracking()
            .GroupBy(m => m.SeasonId)
            .Select(g => new { SeasonId = g.Key, MatchCount = g.Count() })
            .ToDictionaryAsync(x => x.SeasonId, x => x.MatchCount);

        return allSeasons.Select(season =>
        {
            var seasonMatches = userMatches.Where(um => um.SeasonId == season.Id);
            var aggregatedDataForSeason = aggregatedData.Where(a => a.SeasonId == season.Id).ToList();
            var totalMatchesInSeason = totalMatches.TryGetValue(season.Id, out var count) ? count : 0;

            var userData = season.SeasonUsers.Select(su =>
            {
                var userSeasonMatches = seasonMatches.Where(um => um.UserId == su.UserId);
                var aggregatedDataForUser = aggregatedDataForSeason.FirstOrDefault(a => a.UserId == su.UserId);

                var points = userSeasonMatches.SelectMany(um => um.Points);
                var totals = GetTotalsFromPoints(points);

                var totalPlus = aggregatedDataForUser?.TotalPlus ?? 0 + totals.plus;
                var totalMinus = aggregatedDataForUser?.TotalMinus ?? 0 + totals.minus;
                var matchesPlayed = aggregatedDataForUser?.MatchesPlayed ?? 0 + userSeasonMatches.Select(um => um.MatchId).Distinct().Count();

                return new UserPeriodPlusMinusDto(su.UserId, su.User?.Name ?? "", totalPlus, totalMinus, matchesPlayed);
            }).ToList();

            return new PeriodPlusMinusDto(season.Name, userData, totalMatchesInSeason);
        }).ToList();
    }

    // ─── Plus/minus trend per week (with backfill) ────────────────────────────

    public async Task<IEnumerable<PeriodPlusMinusDto>> GetWeeklyPlusMinusTrendAsync(int desiredWeeks = 6)
    {
        var seasons = await _db.Seasons
            .AsNoTracking()
            .OrderByDescending(s => s.StartedOn)
            .ToListAsync();
        if (seasons == null || seasons.Count == 0) return Enumerable.Empty<PeriodPlusMinusDto>();

        // Build week-grouped user matches for the requested season
        var currentWeeks = await BuildWeeklyPeriodsAsync(seasons.First().Id);

        // If few weeks, backfill from previous season (by StartedOn date)
        if (currentWeeks.Count < desiredWeeks)
        {
            var previousSeason = seasons.Skip(1).FirstOrDefault();
            if (previousSeason != null)
            {
                var prevWeeks = await BuildWeeklyPeriodsAsync(previousSeason.Id);
                // Take the last N weeks from the previous season to fill up
                var needed = desiredWeeks - currentWeeks.Count;
                var backfill = prevWeeks.TakeLast(Math.Min(needed, prevWeeks.Count)).ToList();

                // Re-label backfilled weeks to indicate source
                var relabeled = backfill.Select(w =>
                    new PeriodPlusMinusDto($"{previousSeason.Name} {w.Label}", w.Users, w.TotalPeriodMatches));

                return relabeled.Concat(currentWeeks).ToList();
            }
        }

        return currentWeeks;
    }

    private async Task<List<PeriodPlusMinusDto>> BuildWeeklyPeriodsAsync(int seasonId)
    {
        // Load all UserMatches for the season with Match dates and User names
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.User)
            .Include(um => um.Match)
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .Where(um => um.SeasonId == seasonId && um.Match != null && um.Match.MatchDate != null)
            .ToListAsync();

        if (userMatches.Count == 0) return new List<PeriodPlusMinusDto>();

        // Determine week numbers: each distinct match date is a sequential week
        var distinctDates = userMatches
            .Select(um => um.Match!.MatchDate!.Value.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        var dateToWeek = distinctDates
            .Select((date, index) => new { date, week = index + 1 })
            .ToDictionary(x => x.date, x => x.week);

        // Group by week, then by user
        return dateToWeek
            .OrderBy(kv => kv.Value)
            .Select(kv =>
            {
                var weekNum = kv.Value;
                var weekDate = kv.Key;
                var weekMatches = userMatches.Where(um => um.Match!.MatchDate!.Value.Date == weekDate);

                var users = weekMatches
                    .GroupBy(um => new { um.UserId, UserName = um.User?.Name ?? "" })
                    .Select(g =>
                    {
                        var totals = GetTotalsFromPoints(g.SelectMany(um => um.Points));
                        return new UserPeriodPlusMinusDto(
                            g.Key.UserId,
                            g.Key.UserName,
                            totals.plus,
                            totals.minus,
                            g.Select(um => um.MatchId).Distinct().Count());
                    })
                    .OrderBy(u => u.UserName)
                    .ToList();

                return new PeriodPlusMinusDto($"Week {weekNum}", users, weekMatches.Count());
            })
            .ToList();
    }

    // ─── Earnings by season (for stacked chart) ──────────────────────────────

    public async Task<IEnumerable<SeasonalUserEarningsDto>> GetEarningsBySeasonAsync()
    {
        var moneyConfig = await _db.MoneyConfigs
            .AsNoTracking()
            .OrderByDescending(m => m.EffectiveFrom)
            .FirstOrDefaultAsync();
        if (moneyConfig == null)
        {
            // No config means no points have value, so all earnings are zero
            return Enumerable.Empty<SeasonalUserEarningsDto>();
        }

        var userPointsInMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.User)
            .Include(um => um.Match)
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .ToListAsync();

        var aggregatedData = await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .ToListAsync();

        // Merge both sources by (season, user) so either source can contribute independently.
        var mergedBySeasonAndUser = new Dictionary<(int SeasonId, int UserId), (int TotalPlus, int TotalMinus)>();

        foreach (var item in aggregatedData)
        {
            var key = (item.SeasonId, item.UserId);
            mergedBySeasonAndUser[key] = (item.TotalPlus, item.TotalMinus);
        }

        foreach (var userMatch in userPointsInMatches)
        {
            var key = (userMatch.SeasonId, userMatch.UserId);
            if (!mergedBySeasonAndUser.TryGetValue(key, out var current))
            {
                current = (0, 0);
            }

            var totals = GetTotalsFromPoints(userMatch.Points);

            mergedBySeasonAndUser[key] = (
                current.TotalPlus + totals.plus,
                current.TotalMinus + totals.minus);
        }

        var earningsBySeason = mergedBySeasonAndUser
            .GroupBy(x => x.Key.SeasonId)
            .Select(g => new SeasonalUserEarningsDto(
                g.Key,
                g.Select(x =>
                    {
                        var rawEarnings = RawEarnings(moneyConfig, x.Value.TotalPlus, x.Value.TotalMinus);
                        var earnings = Math.Max(0m, rawEarnings);
                        return new UserEarningsDto(x.Key.UserId, earnings);
                    })
                    .OrderByDescending(u => u.Earnings)
                    .ToList()))
            .OrderBy(s => s.SeasonId)
            .ToList();

        return earningsBySeason;
    }

    // ─── All-time earnings ────────────────────────────────────────────────────

    public async Task<AllTimeEarningsDto> GetAllTimeEarningsAsync(IEnumerable<SeasonalUserEarningsDto> seasonalEarnings)
    {
        var totalCollectedList = await _db.UserPayouts
            .AsNoTracking()
            .Select(up => up.Amount)
            .ToListAsync();
        var totalExpensesList = await _db.Expenses
            .AsNoTracking()
            .Select(pe => pe.Amount)
            .ToListAsync();
        var totalCollected = totalCollectedList.Sum();
        var totalExpenses = totalExpensesList.Sum();

        // Aggregate total earnings per user across all seasons 
        var userEarnings = seasonalEarnings
            .SelectMany(s => s.UserEarnings)
            .GroupBy(ue => ue.UserId)
            .Select(g => new UserEarningsDto(g.Key, g.Sum(ue => ue.Earnings)))
            .OrderByDescending(u => u.Earnings)
            .ToList();
        var totalEarnings = userEarnings.Sum(ue => ue.Earnings);
        var canBeCollected = totalEarnings - totalCollected;

        return new AllTimeEarningsDto(userEarnings, totalCollected, canBeCollected, totalExpenses);
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

    // ─── User point-reason breakdown ────────────────────────────────────────

    public async Task<UserPointReasonBreakdownDto?> GetUserPointReasonBreakdownAsync(int userId, int? seasonId = null)
    {
        // Verify user exists
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return null;

        // Query UserMatchPoints filtered by userId and optionally by seasonId
        var query = _db.UserMatchPoints
            .Include(p => p.UserMatch)
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId);

        if (seasonId.HasValue)
            query = query.Where(p => p.UserMatch!.SeasonId == seasonId.Value);

        var points = await query.ToListAsync();

        // Group by PointReasonId and sum counts
        var breakdown = points
            .GroupBy(p => p.PointReasonId)
            .Select(g => new PointReasonBreakdownItemDto(
                g.Key,
                g.First().PointReason?.Name ?? "",
                g.First().PointReason?.IsPositive ?? false,
                g.Sum(p => p.Count)))
            .OrderBy(x => x.PointReasonId)
            .ToList();

        return new UserPointReasonBreakdownDto(userId, user.Name ?? "", breakdown);
    }

    // ─── User match history ───────────────────────────────────────────────────

    public async Task<IEnumerable<UserMatchSummaryDto>> GetUserMatchHistoryAsync(int userId, int? seasonId = null)
    {
        var query = _db.UserMatches
            .Include(um => um.Match).ThenInclude(m => m!.HomeTeam)
            .Include(um => um.Match).ThenInclude(m => m!.AwayTeam)
            .Include(um => um.Match).ThenInclude(m => m!.Season)
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .Include(um => um.Goals)
            .Include(um => um.Penalties)
            .Where(um => um.UserId == userId && um.Match!.MatchDate != null);

        if (seasonId.HasValue)
            query = query.Where(um => um.SeasonId == seasonId.Value);

        var userMatches = await query.ToListAsync();

        return userMatches
            .Select(um =>
            {
                var match = um.Match!;
                var hostedTeamId = match.Season?.HostedTeamId;

                bool isHome;
                string opponentName;
                string opponentShortName;

                if (hostedTeamId.HasValue)
                {
                    isHome = match.HomeTeamId == hostedTeamId.Value;
                    opponentName = isHome
                        ? (match.AwayTeam?.Name ?? "")
                        : (match.HomeTeam?.Name ?? "");
                    opponentShortName = isHome
                        ? (match.AwayTeam?.ShortName ?? "")
                        : (match.HomeTeam?.ShortName ?? "");
                }
                else
                {
                    isHome = true;
                    opponentName = match.AwayTeam?.Name ?? "";
                    opponentShortName = match.AwayTeam?.ShortName ?? "";
                }

                var goalCount = (um.Goals ?? Enumerable.Empty<UserMatchGoal>()).Sum(g => g.Count);
                var penaltyCount = (um.Penalties ?? Enumerable.Empty<UserMatchPenalty>()).Sum(p => p.Count);
                var totals = GetTotalsFromPoints(um.Points ?? Enumerable.Empty<UserMatchPoint>());

                return new UserMatchSummaryDto(
                    match.Id,
                    match.MatchDate!.Value,
                    opponentName,
                    opponentShortName,
                    match.HomeScore,
                    match.AwayScore,
                    isHome,
                    totals.plus,
                    totals.minus,
                    goalCount,
                    penaltyCount,
                    um.SeasonId,
                    match.Season?.Name ?? "");
            })
            .OrderBy(s => s.MatchDate)
            .ToList();
    }

    // ─── Head-to-head ─────────────────────────────────────────────────────────

    public async Task<IEnumerable<HeadToHeadMatchDto>> GetHeadToHeadAsync(int teamId, int hostedTeamId)
    {
        var matches = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Season)
            .Include(m => m.UserMatches!).ThenInclude(um => um.User)
            .Include(m => m.UserMatches!).ThenInclude(um => um.Points).ThenInclude(p => p.PointReason)
            .Where(m =>
                m.MatchDate != null &&
                m.Season!.HostedTeamId == hostedTeamId &&
                (m.HomeTeamId == teamId || m.AwayTeamId == teamId))
            .OrderByDescending(m => m.MatchDate)
            .ToListAsync();

        return matches.Select(m =>
        {
            var userResults = (m.UserMatches ?? Enumerable.Empty<UserMatch>())
                .Select(um => new HeadToHeadUserResultDto(
                    um.UserId,
                    um.User?.Name ?? "",
                    GetTotalsFromPoints(um.Points ?? Enumerable.Empty<UserMatchPoint>()).plus,
                    GetTotalsFromPoints(um.Points ?? Enumerable.Empty<UserMatchPoint>()).minus))
                .ToList();

            return new HeadToHeadMatchDto(
                m.Id,
                m.SeasonId,
                m.Season?.Name ?? "",
                m.MatchDate!.Value,
                m.HomeTeam?.Name ?? "",
                m.HomeTeam?.ShortName ?? "",
                m.AwayTeam?.Name ?? "",
                m.AwayTeam?.ShortName ?? "",
                m.HomeScore,
                m.AwayScore,
                m.CompletionType,
                userResults);
        });
    }

    // ─── Consolidated dashboard data ──────────────────────────────────────────

    public async Task<DashboardDataDto> GetDashboardDataAsync()
    {
        // For season-specific data, we can either use the requested season or default to the most recent one
        var seasonStats = await FetchSeasonPointsStatisticsAsync();
        var earningsBySeason = await GetEarningsBySeasonAsync();
        var rosterScorers = await GetAllGoalScorersByUserAsync();
        var rosterPenalized = await GetAllPenaltyPlayersByUserAsync();
        var trendData = await GetWeeklyPlusMinusTrendAsync();

        // For all-time aggregates, we can reuse some of the season-level data to avoid redundant queries
        var allTimeStats = await GetAllTimeStatsAsync(seasonStats);
        var allTimeEarnings = await GetAllTimeEarningsAsync(earningsBySeason);
        var allTimePlusMinusTrend = await GetAllTimePlusMinusTrendAsync();
        var allTimeRosterScorers = await GetAllTimeRosterScorerAsync(rosterScorers);
        var allTimeRosterPenalized = await GetAllTimePenaltyPlayersByUserAsync(rosterPenalized);

        return new DashboardDataDto(
            seasonStats,
            earningsBySeason,
            trendData,
            rosterScorers,
            rosterPenalized,

            allTimeStats,
            allTimeEarnings,
            allTimePlusMinusTrend,
            allTimeRosterScorers,
            allTimeRosterPenalized);
    }

    public async Task<SeasonTotalsDto> GetSeasonTotalsAsync()
    {
        // fetchSeasonalMetrics
        var pointStats = await FetchSeasonPointsStatisticsAsync();
        var goalStats = await FetchSeasonGoalStatisicsAsync();
        var penaltyStats = await FetchSeasonPenaltyStatisticsAsync();
        var userEarnings = await GetEarningsBySeasonAsync();
        // merge into a single IEnumerable<SeasonUserData>
        var seasonIds = pointStats.Select(ps => ps.SeasonId);
        seasonIds = seasonIds.Union(goalStats.Select(gs => gs.SeasonId));
        seasonIds = seasonIds.Union(penaltyStats.Select(ps => ps.SeasonId));
        seasonIds = seasonIds.Union(userEarnings.Select(ue => ue.SeasonId));
        seasonIds = seasonIds.Distinct();

        var seasons = await _db.Seasons
            .AsNoTracking()
            .Include(s => s.SeasonUsers)
            .Where(s => seasonIds.Contains(s.Id))
            .ToListAsync();

        var seasonalUserData = seasons
            .Select(s =>
            {
                var seasonPointStats = pointStats.FirstOrDefault(ps => ps.SeasonId == s.Id);
                var seasonGoalStats = goalStats.FirstOrDefault(gs => gs.SeasonId == s.Id);
                var seasonPenaltyStats = penaltyStats.FirstOrDefault(ps => ps.SeasonId == s.Id);
                var seasonEarnings = userEarnings.FirstOrDefault(ue => ue.SeasonId == s.Id);

                var userData = s.SeasonUsers.Select(su =>
                {
                    var pointsStat = seasonPointStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    var goalStat = seasonGoalStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    var penaltyStat = seasonPenaltyStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    var earningStat = seasonEarnings?.UserEarnings.FirstOrDefault(ue => ue.UserId == su.UserId);

                    return new SeasonUserDataDto(
                        su.UserId,
                        pointsStat?.TotalPlus ?? 0,
                        pointsStat?.TotalMinus ?? 0,
                        goalStat?.TotalGoals ?? 0,
                        penaltyStat?.TotalPenalties ?? 0,
                        earningStat?.Earnings ?? 0m);
                }).ToList();

                return new SeasonalUserDataDto(s.Id, userData);
            })
            .ToList();

        // fetch top players
        var topRosterPlayers = await GetTopRosterPlayersAsync();

        return new SeasonTotalsDto(
            seasonalUserData,
            topRosterPlayers);
    }

    public async Task<FinancialStatsDto> GetFinancialStatsAsync()
    {
        var allPayouts = await _db.UserPayouts
            .AsNoTracking()
            .ToListAsync();
        var totalCollectedList = allPayouts
            .GroupBy(up => up.UserId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));
        var collectedByUser = totalCollectedList;

        var totalExpensesList = await _db.Expenses
            .AsNoTracking()
            .Select(x => new ExpenseDto(
                x.Id,
                x.Description,
                x.Amount,
                x.Date
            ))
            .ToListAsync();
        var totalCollected = totalCollectedList.Values.Sum(x => x);
        var totalExpenses = totalExpensesList.Sum(x => x.Amount);

        var aggregatedData = await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .GroupBy(a => a.UserId)
            .ToDictionaryAsync(x => x.Key, x => new
            {
                plus = x.Sum(y => y.TotalPlus),
                minus = x.Sum(y => y.TotalMinus)
            });

        var userMatchPoints = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(ump => ump.UserMatch != null)
            .Select(x => new
            {
                x.UserMatch!.UserId,
                plus = x.PointReason != null && x.PointReason.IsPositive ? x.Count : 0,
                minus = x.PointReason != null && !x.PointReason.IsPositive ? x.Count : 0
            }).ToListAsync();
        var userMatchPointsByUser = userMatchPoints
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => new
            {
                plus = g.Sum(x => x.plus),
                minus = g.Sum(x => x.minus)
            });

        var users = await _db.Users
            .AsNoTracking()
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        var moneyConfig = await _db.MoneyConfigs
            .AsNoTracking()
            .OrderByDescending(m => m.EffectiveFrom)
            .FirstOrDefaultAsync();

        var financesByUser = users.Select(u =>
            {
                var matchPoints = userMatchPointsByUser.TryGetValue(u.Key, out var mp) ? mp : new { plus = 0, minus = 0 };
                var aggregated = aggregatedData.TryGetValue(u.Key, out var a) ? a : new { plus = 0, minus = 0 };
                var collected = collectedByUser.TryGetValue(u.Key, out var amount) ? amount : 0m;

                var totalPluses = aggregated.plus + matchPoints.plus;
                var totalMinuses = aggregated.minus + matchPoints.minus;
                var earnings = 0m;
                if (moneyConfig != null)
                {
                    earnings = Math.Max(0m, RawEarnings(moneyConfig, totalPluses, totalMinuses));
                }
                var canBeCollected = earnings - collected;

                return new UserFinancialStatsDto(
                    u.Key,
                    totalPluses,
                    totalMinuses,
                    collected,
                    earnings,
                    canBeCollected);
            })
            .OrderByDescending(x => x.TotalEarnings)
            .ThenBy(x => x.UserId)
            .ToList();

        var totalEarnings = financesByUser.Sum(x => x.TotalEarnings);
        var canBeCollected = financesByUser.Sum(x => x.CanBeCollected);

        return new FinancialStatsDto(
            totalCollected,
            totalExpenses,
            canBeCollected,
            totalEarnings,
            totalExpensesList,
            financesByUser);
    }
}

