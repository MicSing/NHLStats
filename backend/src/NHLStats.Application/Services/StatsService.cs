using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class StatsService : IStatsService
{
    private readonly NhlStatsDbContext _db;
    private readonly IBettingCalculator _calculator;

    public StatsService(NhlStatsDbContext db, IBettingCalculator calculator)
    {
        _db = db;
        _calculator = calculator;
    }

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

    private async Task<Dictionary<int, BettingBreakdown>> ComputeEarningsAsync(
        List<int> matchIds,
        IReadOnlyDictionary<int, int>? aggregatedPlusCountByUser = null,
        IReadOnlyDictionary<int, int>? aggregatedMinusCountByUser = null,
        bool allTimeBets = false)
    {
        var dataByUser = await _calculator.LoadForUsersAsync(
            matchIds, allTimeBets, aggregatedPlusCountByUser, aggregatedMinusCountByUser);
        return dataByUser.ToDictionary(kv => kv.Key, kv => _calculator.Compute(kv.Value));
    }

    /// <summary>Raw (unclamped) contribution for one UserMatch entry. Clamp to 0 only at the per-user aggregate level.</summary>
    private static decimal RawEarnings(MoneyConfig config, int totalPlus, int totalMinus) =>
        totalMinus * config.NegativePointValue - totalPlus * config.PositivePointValue;

    private static (int plus, int minus) GetTotalsFromPoints(IEnumerable<UserMatchPoint> points)
    {
        var plus = points
            .Where(p => p.PointReason != null && p.PointReason.PointType == PointType.Positive)
            .Sum(p => p.Count);
        var minus = points
            .Where(p => p.PointReason != null && p.PointReason.PointType == PointType.Negative)
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
                UserId = p.UserMatch.UserId,
                p.Count,
                IsPositive = p.PointReason != null && p.PointReason.PointType == PointType.Positive
            })
            .ToListAsync();

        // Per-user per-match goals
        var goalRows = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch != null && matchIds.Contains(g.UserMatch.MatchId))
            .Select(g => new { g.UserMatch!.MatchId, g.UserMatch.UserId, g.Count })
            .ToListAsync();

        // Per-user per-match penalties
        var penaltyRows = await _db.UserMatchPenalties
            .AsNoTracking()
            .Where(p => p.UserMatch != null && matchIds.Contains(p.UserMatch.MatchId))
            .Select(p => new { p.UserMatch!.MatchId, p.UserMatch.UserId, p.Count })
            .ToListAsync();

        // Per-user per-match bets — grouped by the bettor (CreatedBy → ApplicationUser.UserId)
        var betCreatorIds = await _db.Bets
            .AsNoTracking()
            .Where(b => matchIds.Contains(b.MatchId))
            .Select(b => b.CreatedBy)
            .Distinct()
            .ToListAsync();

        var creatorToGameUserId = await _db.Set<NHLStats.Domain.Identity.ApplicationUser>()
            .AsNoTracking()
            .Where(u => betCreatorIds.Contains(u.Id) && u.UserId.HasValue)
            .ToDictionaryAsync(u => u.Id, u => u.UserId!.Value);

        var betRows = await _db.Bets
            .AsNoTracking()
            .Where(b => matchIds.Contains(b.MatchId))
            .Select(b => new { b.MatchId, b.CreatedBy, b.Amount, b.Odds, b.Status, b.BetType, b.UserId, b.TeamId })
            .ToListAsync();

        // Load target names for bet display
        var betTargetUserIds = betRows.Where(b => b.UserId.HasValue).Select(b => b.UserId!.Value).Distinct().ToList();
        var betTargetTeamIds = betRows.Where(b => b.TeamId.HasValue).Select(b => b.TeamId!.Value).Distinct().ToList();
        var betTargetUserNames = await _db.Users.AsNoTracking()
            .Where(u => betTargetUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? $"User {u.Id}");
        var betTargetTeamNames = await _db.Teams.AsNoTracking()
            .Where(t => betTargetTeamIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.ShortName ?? t.Name ?? $"Team {t.Id}");

        var betsByMatchUser = betRows
            .Where(b => creatorToGameUserId.ContainsKey(b.CreatedBy))
            .GroupBy(b => (b.MatchId, UserId: creatorToGameUserId[b.CreatedBy]))
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var primary = g.OrderByDescending(b =>
                        b.Status == BetStatus.Won ? 3 :
                        b.Status == BetStatus.Lost ? 2 :
                        b.Status == BetStatus.Pending ? 1 : 0).First();
                    var targetName = primary.BetType == BetType.TeamWin && primary.TeamId.HasValue
                        ? betTargetTeamNames.GetValueOrDefault(primary.TeamId.Value)
                        : primary.UserId.HasValue
                            ? betTargetUserNames.GetValueOrDefault(primary.UserId.Value)
                            : null;
                    return new
                    {
                        Status = g.Any(b => b.Status == BetStatus.Won) ? BetStatus.Won :
                                 g.Any(b => b.Status == BetStatus.Lost) ? BetStatus.Lost :
                                 g.Any(b => b.Status == BetStatus.Pending) ? BetStatus.Pending :
                                 BetStatus.Cancelled,
                        Amount = g.Sum(b => b.Amount),
                        WonAmount = g.Where(b => b.Status == BetStatus.Won).Sum(b => BettingConstants.GrossPayout(b.Amount, b.Odds)),
                        BetType = primary.BetType,
                        TargetName = targetName
                    };
                });

        // Load user names for all users involved (including bet placers)
        var allUserIds = pointRows.Select(r => r.UserId)
            .Union(goalRows.Select(r => r.UserId))
            .Union(penaltyRows.Select(r => r.UserId))
            .Union(betsByMatchUser.Keys.Select(k => k.UserId))
            .Distinct()
            .ToList();

        var userNames = await _db.Users
            .AsNoTracking()
            .Where(u => allUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? $"User {u.Id}");

        // Build per-user per-match point totals
        var userPointsByMatch = pointRows
            .GroupBy(r => new { r.MatchId, r.UserId })
            .ToDictionary(
                g => (g.Key.MatchId, g.Key.UserId),
                g => (Plus: g.Where(x => x.IsPositive).Sum(x => x.Count),
                       Minus: g.Where(x => !x.IsPositive).Sum(x => x.Count)));

        var userGoalsByMatch = goalRows
            .GroupBy(r => (r.MatchId, r.UserId))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count));
        var userPenaltiesByMatch = penaltyRows
            .GroupBy(r => (r.MatchId, r.UserId))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count));

        // Collect all (matchId, userId) pairs — include bet placers even if they have no stats
        var matchUserPairs = pointRows.Select(r => (r.MatchId, r.UserId))
            .Union(goalRows.Select(r => (r.MatchId, r.UserId)))
            .Union(penaltyRows.Select(r => (r.MatchId, r.UserId)))
            .Union(betsByMatchUser.Keys.Select(k => (k.MatchId, k.UserId)))
            .Distinct()
            .ToList();

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

        var weeklyMatches = matches.Select(m =>
        {
            var users = matchUserPairs
                .Where(p => p.MatchId == m.Id)
                .Select(p =>
                {
                    var pts = userPointsByMatch.TryGetValue((m.Id, p.UserId), out var v) ? v : (Plus: 0, Minus: 0);
                    var goals = userGoalsByMatch.TryGetValue((m.Id, p.UserId), out var g) ? g : 0;
                    var pens = userPenaltiesByMatch.TryGetValue((m.Id, p.UserId), out var pen) ? pen : 0;
                    betsByMatchUser.TryGetValue((m.Id, p.UserId), out var bet);
                    return new WeeklyMatchUserDto(
                        p.UserId,
                        userNames.TryGetValue(p.UserId, out var name) ? name : $"User {p.UserId}",
                        pts.Plus,
                        pts.Minus,
                        goals,
                        pens,
                        bet != null ? bet.Status : (BetStatus?)null,
                        bet?.Amount,
                        bet != null && bet.WonAmount > 0 ? bet.WonAmount : null,
                        bet?.BetType,
                        bet?.TargetName);
                })
                .OrderBy(u => u.UserId)
                .ToList();

            return new WeeklyMatchDto(
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
                m.CompletionType,
                users);
        });

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
        // Group matches by season so we can scope ComputeEarningsAsync per season
        var matchesBySeason = await _db.Matches
            .AsNoTracking()
            .Select(m => new { m.Id, m.SeasonId })
            .ToListAsync();

        if (matchesBySeason.Count == 0)
            return Enumerable.Empty<SeasonalUserEarningsDto>();

        var seasonIds = matchesBySeason.Select(m => m.SeasonId).Distinct().ToList();
        var result = new List<SeasonalUserEarningsDto>();

        foreach (var seasonId in seasonIds)
        {
            var matchIds = matchesBySeason
                .Where(m => m.SeasonId == seasonId)
                .Select(m => m.Id)
                .ToList();

            var earningsByUser = await ComputeEarningsAsync(matchIds);
            result.Add(new SeasonalUserEarningsDto(
                seasonId,
                earningsByUser
                    .Select(kv => new UserEarningsDto(kv.Key, kv.Value.Earnings))
                    .OrderByDescending(u => u.Earnings)
                    .ToList()));
        }

        return result.OrderBy(s => s.SeasonId).ToList();
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

    // ─── Season stats endpoint — per-user totals + earnings ──────────────────

    public async Task<IEnumerable<SeasonStatsUserDto>> GetSeasonStatsAsync(int seasonId)
    {
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .Where(um => um.SeasonId == seasonId)
            .ToListAsync();

        if (userMatches.Count == 0)
            return Enumerable.Empty<SeasonStatsUserDto>();

        var matchIds = userMatches
            .Select(um => um.MatchId)
            .Distinct()
            .ToList();

        var earningsByUser = await ComputeEarningsAsync(matchIds);

        return userMatches
            .GroupBy(um => um.UserId)
            .Select(g =>
            {
                var totalPlus = 0;
                var totalMinus = 0;
                foreach (var um in g)
                {
                    var totals = GetTotalsFromPoints(um.Points);
                    totalPlus += totals.plus;
                    totalMinus += totals.minus;
                }
                earningsByUser.TryGetValue(g.Key, out var fin);
                return new SeasonStatsUserDto(g.Key, totalPlus, totalMinus, fin?.Earnings ?? 0m, fin?.AvailableBalance ?? 0m);
            })
            .OrderBy(s => s.UserId)
            .ToList();
    }

    // ─── All-time earnings summary endpoint ──────────────────────────────────

    public async Task<EarningsSummaryDto> GetEarningsSummaryAsync()
    {
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .ToListAsync();

        var allMatchIds = userMatches
            .Select(um => um.MatchId)
            .Distinct()
            .ToList();

        var earningsByUser = await ComputeEarningsAsync(allMatchIds, allTimeBets: true);

        var plusMinusByUser = userMatches
            .GroupBy(um => um.UserId)
            .ToDictionary(g => g.Key, g =>
            {
                var plus = 0; var minus = 0;
                foreach (var um in g) { var t = GetTotalsFromPoints(um.Points); plus += t.plus; minus += t.minus; }
                return (plus, minus);
            });

        var totalCollected = (await _db.UserPayouts.AsNoTracking().Select(up => up.Amount).ToListAsync()).Sum();
        var totalExpenses = (await _db.Expenses.AsNoTracking().Select(e => e.Amount).ToListAsync()).Sum();

        var allUserIds = plusMinusByUser.Keys.Union(earningsByUser.Keys).Distinct();
        var userEarnings = allUserIds
            .Select(uid =>
            {
                plusMinusByUser.TryGetValue(uid, out var pm);
                earningsByUser.TryGetValue(uid, out var fin);
                return new EarningsSummaryUserDto(uid, fin?.Earnings ?? 0m, pm.plus, pm.minus);
            })
            .OrderByDescending(u => u.Earnings)
            .ToList();

        return new EarningsSummaryDto(userEarnings, totalCollected, totalExpenses, totalCollected - totalExpenses);
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
                g.First().PointReason?.PointType.ToString() ?? "Negative",
                g.Sum(p => p.Count)))
            .OrderBy(x => x.PointReasonId)
            .ToList();

        return new UserPointReasonBreakdownDto(userId, user.Name ?? "", breakdown);
    }

    // ─── User match history ───────────────────────────────────────────────────

    public async Task<IEnumerable<SeasonMatchHistoryDto>> GetUserMatchHistoryAsync(int userId, int? seasonId = null)
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

        // Load aggregated season data for this user
        var aggQuery = _db.UserSeasonAggregatedData
            .Include(a => a.Season)
            .Where(a => a.UserId == userId);

        if (seasonId.HasValue)
            aggQuery = aggQuery.Where(a => a.SeasonId == seasonId.Value);

        var aggregatedData = await aggQuery.ToListAsync();
        var aggBySeasonId = aggregatedData.ToDictionary(a => a.SeasonId);

        // Map each UserMatch to a flat intermediate with season context
        var mapped = userMatches.Select(um =>
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

            return new
            {
                SeasonId = um.SeasonId,
                SeasonName = match.Season?.Name ?? "",
                MatchDate = match.MatchDate!.Value,
                Item = new MatchHistoryItemDto(
                    match.MatchDate!.Value,
                    opponentName,
                    opponentShortName,
                    match.HomeScore,
                    match.AwayScore,
                    isHome,
                    totals.plus,
                    totals.minus,
                    goalCount,
                    penaltyCount)
            };
        }).ToList();

        // Build season DTOs from match-based data, merging aggregated totals
        var matchSeasonIds = mapped.Select(x => x.SeasonId).Distinct().ToHashSet();
        var result = new List<SeasonMatchHistoryDto>();

        // Seasons that have match data
        var matchSeasons = mapped
            .GroupBy(x => x.SeasonId)
            .OrderBy(g => g.Min(x => x.MatchDate))
            .Select(seasonGroup =>
            {
                var seasonName = seasonGroup.First().SeasonName;
                var distinctDates = seasonGroup
                    .Select(x => x.MatchDate.Date)
                    .Distinct()
                    .OrderBy(d => d)
                    .ToList();

                var dateToWeek = distinctDates
                    .Select((date, index) => new { date, week = index + 1 })
                    .ToDictionary(x => x.date, x => x.week);

                var weeks = seasonGroup
                    .GroupBy(x => dateToWeek[x.MatchDate.Date])
                    .OrderBy(wg => wg.Key)
                    .Select(wg =>
                    {
                        var items = wg.OrderBy(x => x.MatchDate).Select(x => x.Item).ToList();
                        return new WeekMatchHistoryDto(
                            wg.Key,
                            items.Sum(i => i.TotalPlus),
                            items.Sum(i => i.TotalMinus),
                            items.Sum(i => i.GoalCount),
                            items.Sum(i => i.PenaltyCount),
                            items);
                    })
                    .ToList();

                // Merge aggregated data into season-level totals
                aggBySeasonId.TryGetValue(seasonGroup.Key, out var agg);
                var aggPlus = agg?.TotalPlus ?? 0;
                var aggMinus = agg?.TotalMinus ?? 0;

                return new SeasonMatchHistoryDto(
                    seasonGroup.Key,
                    seasonName,
                    weeks.Sum(w => w.TotalPlus) + aggPlus,
                    weeks.Sum(w => w.TotalMinus) + aggMinus,
                    weeks.Sum(w => w.GoalCount),
                    weeks.Sum(w => w.PenaltyCount),
                    weeks);
            })
            .ToList();

        result.AddRange(matchSeasons);

        // Seasons that only have aggregated data (no matches)
        var aggOnlySeasons = aggregatedData
            .Where(a => !matchSeasonIds.Contains(a.SeasonId))
            .OrderBy(a => a.Season?.StartedOn)
            .Select(a => new SeasonMatchHistoryDto(
                a.SeasonId,
                a.Season?.Name ?? "",
                a.TotalPlus,
                a.TotalMinus,
                0,
                0,
                Enumerable.Empty<WeekMatchHistoryDto>()))
            .ToList();

        result.AddRange(aggOnlySeasons);

        return result;
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
        var pointStats = await FetchSeasonPointsStatisticsAsync();
        var goalStats = await FetchSeasonGoalStatisicsAsync();
        var penaltyStats = await FetchSeasonPenaltyStatisticsAsync();

        var matchesBySeason = await _db.Matches
            .AsNoTracking()
            .Select(m => new { m.Id, m.SeasonId })
            .ToListAsync();

        var seasonIds = pointStats.Select(ps => ps.SeasonId)
            .Union(goalStats.Select(gs => gs.SeasonId))
            .Union(penaltyStats.Select(ps => ps.SeasonId))
            .Union(matchesBySeason.Select(m => m.SeasonId))
            .Distinct();

        var seasons = await _db.Seasons
            .AsNoTracking()
            .Include(s => s.SeasonUsers)
            .Where(s => seasonIds.Contains(s.Id))
            .ToListAsync();

        // compute earnings + betting balance per season
        var earningsBySeasonAndUser = new Dictionary<int, Dictionary<int, BettingBreakdown>>();
        foreach (var season in seasons)
        {
            var matchIds = matchesBySeason
                .Where(m => m.SeasonId == season.Id)
                .Select(m => m.Id)
                .ToList();
            earningsBySeasonAndUser[season.Id] = await ComputeEarningsAsync(matchIds);
        }

        var seasonalUserData = seasons
            .Select(s =>
            {
                var seasonPointStats = pointStats.FirstOrDefault(ps => ps.SeasonId == s.Id);
                var seasonGoalStats = goalStats.FirstOrDefault(gs => gs.SeasonId == s.Id);
                var seasonPenaltyStats = penaltyStats.FirstOrDefault(ps => ps.SeasonId == s.Id);
                earningsBySeasonAndUser.TryGetValue(s.Id, out var seasonEarnings);

                var userData = s.SeasonUsers.Select(su =>
                {
                    var pointsStat = seasonPointStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    var goalStat = seasonGoalStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    var penaltyStat = seasonPenaltyStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    BettingBreakdown? fin = null;
                    seasonEarnings?.TryGetValue(su.UserId, out fin);

                    return new SeasonUserDataDto(
                        su.UserId,
                        pointsStat?.TotalPlus ?? 0,
                        pointsStat?.TotalMinus ?? 0,
                        goalStat?.TotalGoals ?? 0,
                        penaltyStat?.TotalPenalties ?? 0,
                        fin?.Earnings ?? 0m,
                        fin?.AvailableBalance ?? 0m);
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
        var collectedByUser = allPayouts
            .GroupBy(up => up.UserId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var totalExpensesList = await _db.Expenses
            .AsNoTracking()
            .Select(x => new ExpenseDto(x.Id, x.Description, x.Amount, x.Date))
            .ToListAsync();

        var totalCollected = collectedByUser.Values.Sum();
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
                plus = x.PointReason != null && x.PointReason.PointType == PointType.Positive ? x.Count : 0,
                minus = x.PointReason != null && x.PointReason.PointType == PointType.Negative ? x.Count : 0
            }).ToListAsync();
        var userMatchPointsByUser = userMatchPoints
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => new
            {
                plus = g.Sum(x => x.plus),
                minus = g.Sum(x => x.minus)
            });

        var allMatchIds = await _db.UserMatches
            .AsNoTracking()
            .Where(um => um.MatchId != 0)
            .Select(um => um.MatchId)
            .Distinct()
            .ToListAsync();

        var aggregatedPlusCounts  = aggregatedData.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.plus);
        var aggregatedMinusCounts = aggregatedData.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.minus);
        var earningsByUser = await ComputeEarningsAsync(allMatchIds, aggregatedPlusCounts, aggregatedMinusCounts, allTimeBets: true);

        var users = await _db.Users
            .AsNoTracking()
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        var financesByUser = users.Select(u =>
            {
                var matchPoints = userMatchPointsByUser.TryGetValue(u.Key, out var mp) ? mp : new { plus = 0, minus = 0 };
                var aggregated = aggregatedData.TryGetValue(u.Key, out var a) ? a : new { plus = 0, minus = 0 };
                var collected = collectedByUser.TryGetValue(u.Key, out var amount) ? amount : 0m;

                var totalPluses = aggregated.plus + matchPoints.plus;
                var totalMinuses = aggregated.minus + matchPoints.minus;

                earningsByUser.TryGetValue(u.Key, out var fin);
                var earnings = fin?.Earnings ?? 0m;
                var bettingBalance = fin?.AvailableBalance ?? 0m;
                var canBeCollected = earnings - collected;

                return new UserFinancialStatsDto(
                    u.Key,
                    totalPluses,
                    totalMinuses,
                    collected,
                    earnings,
                    canBeCollected,
                    bettingBalance,
                    fin?.TotalPendingStake ?? 0m,
                    fin?.TotalWonProfit ?? 0m,
                    fin?.TotalLostStake ?? 0m,
                    fin?.TotalNegativeCash ?? 0m);
            })
            .OrderByDescending(x => x.CanBeCollected)
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

