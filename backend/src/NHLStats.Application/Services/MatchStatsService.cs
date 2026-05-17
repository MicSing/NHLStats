using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class MatchStatsService : IMatchStatsService
{
    private readonly NhlStatsDbContext _db;

    public MatchStatsService(NhlStatsDbContext db)
    {
        _db = db;
    }

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
                PointType = p.PointReason != null ? p.PointReason.PointType : PointType.Negative
            })
            .ToListAsync();

        var goalRows = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch != null && matchIds.Contains(g.UserMatch.MatchId))
            .Select(g => new { g.UserMatch!.MatchId, g.UserMatch.UserId, g.Count })
            .ToListAsync();

        var penaltyRows = await _db.UserMatchPenalties
            .AsNoTracking()
            .Where(p => p.UserMatch != null && matchIds.Contains(p.UserMatch.MatchId))
            .Select(p => new { p.UserMatch!.MatchId, p.UserMatch.UserId, p.Count })
            .ToListAsync();

        var legRows = await _db.BetLegs
            .AsNoTracking()
            .Include(l => l.Bet)
            .Where(l => matchIds.Contains(l.MatchId))
            .Select(l => new
            {
                l.MatchId,
                CreatedBy = l.Bet!.CreatedBy,
                Stake = l.Bet!.Stake,
                TotalOdds = l.Bet!.TotalOdds,
                BetStatus = l.Bet!.Status,
                LegStatus = l.Status,
                l.BetType,
                l.UserId,
                l.TeamId
            })
            .ToListAsync();

        var creatorIdsForBets = legRows.Select(r => r.CreatedBy).Distinct().ToList();
        var creatorToGameUserId = await _db.Set<NHLStats.Domain.Identity.ApplicationUser>()
            .AsNoTracking()
            .Where(u => creatorIdsForBets.Contains(u.Id) && u.UserId.HasValue)
            .ToDictionaryAsync(u => u.Id, u => u.UserId!.Value);

        var legTargetUserIds = legRows.Where(r => r.UserId.HasValue).Select(r => r.UserId!.Value).Distinct().ToList();
        var legTargetTeamIds = legRows.Where(r => r.TeamId.HasValue).Select(r => r.TeamId!.Value).Distinct().ToList();
        var betTargetUserNames = await _db.Users.AsNoTracking()
            .Where(u => legTargetUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? $"User {u.Id}");
        var betTargetTeamNames = await _db.Teams.AsNoTracking()
            .Where(t => legTargetTeamIds.Contains(t.Id))
            .ToDictionaryAsync(t => t.Id, t => t.ShortName ?? t.Name ?? $"Team {t.Id}");

        var betsByMatchUser = legRows
            .Where(r => creatorToGameUserId.ContainsKey(r.CreatedBy))
            .GroupBy(r => (r.MatchId, UserId: creatorToGameUserId[r.CreatedBy]))
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var primary = g.OrderByDescending(r =>
                        r.LegStatus == BetLegStatus.Won ? 3 :
                        r.LegStatus == BetLegStatus.Lost ? 2 :
                        r.LegStatus == BetLegStatus.Pending ? 1 : 0).First();
                    var targetName = primary.BetType == BetType.TeamWin && primary.TeamId.HasValue
                        ? betTargetTeamNames.GetValueOrDefault(primary.TeamId.Value)
                        : primary.UserId.HasValue
                            ? betTargetUserNames.GetValueOrDefault(primary.UserId.Value)
                            : null;
                    var status =
                        g.Any(r => r.LegStatus == BetLegStatus.Won) ? BetStatus.Won :
                        g.Any(r => r.LegStatus == BetLegStatus.Lost) ? BetStatus.Lost :
                        g.Any(r => r.LegStatus == BetLegStatus.Pending) ? BetStatus.Pending :
                        BetStatus.Cancelled;
                    return new
                    {
                        Status = status,
                        Amount = g.Sum(r => r.Stake),
                        WonAmount = g.Where(r => r.BetStatus == BetStatus.Won)
                                     .Sum(r => BettingConstants.GrossPayout(r.Stake, r.TotalOdds)),
                        BetType = primary.BetType,
                        TargetName = targetName
                    };
                });

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

        var userPointsByMatch = pointRows
            .GroupBy(r => new { r.MatchId, r.UserId })
            .ToDictionary(
                g => (g.Key.MatchId, g.Key.UserId),
                g => (Plus:    g.Where(x => x.PointType == PointType.Positive).Sum(x => x.Count),
                      Minus:   g.Where(x => x.PointType == PointType.Negative).Sum(x => x.Count),
                      Neutral: g.Where(x => x.PointType == PointType.Neutral).Sum(x => x.Count)));

        var userGoalsByMatch = goalRows
            .GroupBy(r => (r.MatchId, r.UserId))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count));
        var userPenaltiesByMatch = penaltyRows
            .GroupBy(r => (r.MatchId, r.UserId))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count));

        var matchUserPairs = pointRows.Select(r => (r.MatchId, r.UserId))
            .Union(goalRows.Select(r => (r.MatchId, r.UserId)))
            .Union(penaltyRows.Select(r => (r.MatchId, r.UserId)))
            .Union(betsByMatchUser.Keys.Select(k => (k.MatchId, k.UserId)))
            .Distinct()
            .ToList();

        var totalsByWeek = new Dictionary<int, (int plus, int minus, int neutral)>();

        foreach (var row in pointRows)
        {
            if (!matchIdToWeek.TryGetValue(row.MatchId, out var week))
            {
                continue;
            }

            if (!totalsByWeek.TryGetValue(week, out var totals))
            {
                totals = (0, 0, 0);
            }

            if (row.PointType == PointType.Positive)
            {
                totals.plus += row.Count;
            }
            else if (row.PointType == PointType.Negative)
            {
                totals.minus += row.Count;
            }
            else
            {
                totals.neutral += row.Count;
            }

            totalsByWeek[week] = totals;
        }

        var weeklyMatches = matches.Select(m =>
        {
            var users = matchUserPairs
                .Where(p => p.MatchId == m.Id)
                .Select(p =>
                {
                    var pts = userPointsByMatch.TryGetValue((m.Id, p.UserId), out var v) ? v : (Plus: 0, Minus: 0, Neutral: 0);
                    var goals = userGoalsByMatch.TryGetValue((m.Id, p.UserId), out var g) ? g : 0;
                    var pens = userPenaltiesByMatch.TryGetValue((m.Id, p.UserId), out var pen) ? pen : 0;
                    betsByMatchUser.TryGetValue((m.Id, p.UserId), out var bet);
                    return new WeeklyMatchUserDto(
                        p.UserId,
                        userNames.TryGetValue(p.UserId, out var name) ? name : $"User {p.UserId}",
                        pts.Plus,
                        pts.Minus,
                        pts.Neutral,
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
                    : (plus: 0, minus: 0, neutral: 0);
                var orderedMatches = g
                    .OrderByDescending(m => m.MatchDate)
                    .ToList();
                return new WeekGroupDto(g.Key, totals.plus, totals.minus, totals.neutral, orderedMatches);
            })
            .ToList();
    }

    public async Task<UserPointReasonBreakdownDto?> GetUserPointReasonBreakdownAsync(int userId, int? seasonId = null)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return null;

        var query = _db.UserMatchPoints
            .Include(p => p.UserMatch)
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId);

        if (seasonId.HasValue)
            query = query.Where(p => p.UserMatch!.SeasonId == seasonId.Value);

        var points = await query.ToListAsync();

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
                    StatsCalculationHelpers.GetTotalsFromPoints(um.Points ?? Enumerable.Empty<UserMatchPoint>()).plus,
                    StatsCalculationHelpers.GetTotalsFromPoints(um.Points ?? Enumerable.Empty<UserMatchPoint>()).minus))
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

        var aggQuery = _db.UserSeasonAggregatedData
            .Include(a => a.Season)
            .Where(a => a.UserId == userId);

        if (seasonId.HasValue)
            aggQuery = aggQuery.Where(a => a.SeasonId == seasonId.Value);

        var aggregatedData = await aggQuery.ToListAsync();
        var aggBySeasonId = aggregatedData.ToDictionary(a => a.SeasonId);

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
            var totals = StatsCalculationHelpers.GetTotalsFromPoints(um.Points ?? Enumerable.Empty<UserMatchPoint>());

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

        var matchSeasonIds = mapped.Select(x => x.SeasonId).Distinct().ToHashSet();
        var result = new List<SeasonMatchHistoryDto>();

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
                var totals = StatsCalculationHelpers.GetTotalsFromPoints(points);

                var totalPlus = aggregatedDataForUser?.TotalPlus ?? 0 + totals.plus;
                var totalMinus = aggregatedDataForUser?.TotalMinus ?? 0 + totals.minus;
                var matchesPlayed = aggregatedDataForUser?.MatchesPlayed ?? 0 + userSeasonMatches.Select(um => um.MatchId).Distinct().Count();

                return new UserPeriodPlusMinusDto(su.UserId, su.User?.Name ?? "", totalPlus, totalMinus, matchesPlayed);
            }).ToList();

            return new PeriodPlusMinusDto(season.Name, userData, totalMatchesInSeason);
        }).ToList();
    }

    public async Task<IEnumerable<PeriodPlusMinusDto>> GetWeeklyPlusMinusTrendAsync(int desiredWeeks = 6)
    {
        var seasons = await _db.Seasons
            .AsNoTracking()
            .OrderByDescending(s => s.StartedOn)
            .ToListAsync();
        if (seasons == null || seasons.Count == 0) return Enumerable.Empty<PeriodPlusMinusDto>();

        var currentWeeks = await BuildWeeklyPeriodsAsync(seasons.First().Id);

        if (currentWeeks.Count < desiredWeeks)
        {
            var previousSeason = seasons.Skip(1).FirstOrDefault();
            if (previousSeason != null)
            {
                var prevWeeks = await BuildWeeklyPeriodsAsync(previousSeason.Id);
                var needed = desiredWeeks - currentWeeks.Count;
                var backfill = prevWeeks.TakeLast(Math.Min(needed, prevWeeks.Count)).ToList();

                var relabeled = backfill.Select(w =>
                    new PeriodPlusMinusDto($"{previousSeason.Name} {w.Label}", w.Users, w.TotalPeriodMatches));

                return relabeled.Concat(currentWeeks).ToList();
            }
        }

        return currentWeeks;
    }

    public async Task<List<PeriodPlusMinusDto>> BuildWeeklyPeriodsAsync(int seasonId)
    {
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.User)
            .Include(um => um.Match)
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .Where(um => um.SeasonId == seasonId && um.Match != null && um.Match.MatchDate != null)
            .ToListAsync();

        if (userMatches.Count == 0) return new List<PeriodPlusMinusDto>();

        var distinctDates = userMatches
            .Select(um => um.Match!.MatchDate!.Value.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        var dateToWeek = distinctDates
            .Select((date, index) => new { date, week = index + 1 })
            .ToDictionary(x => x.date, x => x.week);

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
                        var totals = StatsCalculationHelpers.GetTotalsFromPoints(g.SelectMany(um => um.Points));
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
}
