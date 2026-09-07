using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using NHLStats.Domain.Identity;

namespace NHLStats.Application.Services;

public class AchievementService : IAchievementService
{
    private readonly NhlStatsDbContext _db;

    private static readonly HashSet<string> ForwardPositions =
        new(StringComparer.OrdinalIgnoreCase) { "LW", "C", "RW" };

    private static int ToMatchLevel(int count) => count switch {
        >= 820 => 7,
        >= 300 => 6,
        >= 100 => 5,
        >= 30  => 4,
        >= 10  => 3,
        >= 3   => 2,
        >= 1   => 1,
        _      => 0
    };

    private static int ToWeekLevel(int count) => count switch {
        >= 130 => 7,
        >= 65  => 6,
        >= 26  => 5,
        >= 13  => 4,
        >= 5   => 3,
        >= 2   => 2,
        >= 1   => 1,
        _      => 0
    };

    private static int ToSeasonLevel(int count) => count switch {
        >= 10 => 7,
        >= 8  => 6,
        >= 6  => 5,
        >= 4  => 4,
        >= 3  => 3,
        >= 2  => 2,
        >= 1  => 1,
        _     => 0
    };

    private static (int current, int? next) MatchLevelRange(int count) => count switch {
        >= 820 => (820, null),
        >= 300 => (300, 820),
        >= 100 => (100, 300),
        >= 30  => (30,  100),
        >= 10  => (10,  30),
        >= 3   => (3,   10),
        >= 1   => (1,   3),
        _      => (0,   1),
    };

    private static (int current, int? next) WeekLevelRange(int count) => count switch {
        >= 130 => (130, null),
        >= 65  => (65,  130),
        >= 26  => (26,  65),
        >= 13  => (13,  26),
        >= 5   => (5,   13),
        >= 2   => (2,   5),
        >= 1   => (1,   2),
        _      => (0,   1),
    };

    private static (int current, int? next) SeasonLevelRange(int count) => count switch {
        >= 10 => (10, null),
        >= 8  => (8,  10),
        >= 6  => (6,  8),
        >= 4  => (4,  6),
        >= 3  => (3,  4),
        >= 2  => (2,  3),
        >= 1  => (1,  2),
        _     => (0,  1),
    };

    private static AchievementResultDto MatchResult(string id, List<AchievementOccurrenceDto> occs)
    {
        var (cur, next) = MatchLevelRange(occs.Count);
        return new(id, occs.Count > 0, ToMatchLevel(occs.Count), occs.Count, cur, next, occs);
    }

    private static AchievementResultDto WeekResult(string id, List<AchievementOccurrenceDto> occs)
    {
        var (cur, next) = WeekLevelRange(occs.Count);
        return new(id, occs.Count > 0, ToWeekLevel(occs.Count), occs.Count, cur, next, occs);
    }

    private static AchievementResultDto SeasonResult(string id, List<AchievementOccurrenceDto> occs)
    {
        var (cur, next) = SeasonLevelRange(occs.Count);
        return new(id, occs.Count > 0, ToSeasonLevel(occs.Count), occs.Count, cur, next, occs);
    }

    public AchievementService(NhlStatsDbContext db) => _db = db;

    public async Task<UserAchievementsDto> GetUserAchievementsAsync(int userId)
    {
        // ─── 0. Complete season IDs ───────────────────────────────────────────
        var completeSeasonIds = (await _db.Seasons
            .AsNoTracking()
            .Where(s => s.Status == SeasonStatus.Complete)
            .Select(s => s.Id)
            .ToListAsync()).ToHashSet();

        // ─── 1. User goals ────────────────────────────────────────────────────
        var goals = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch!.UserId == userId
                     && g.UserMatch.Match!.CompletionType != CompletionType.None
                     && g.UserMatch.Match.CompletionType != CompletionType.InProgress)
            .Select(g => new
            {
                MatchId       = g.UserMatch!.MatchId,
                MatchDate     = g.UserMatch.Match!.MatchDate,
                SeasonId      = g.UserMatch.SeasonId,
                SeasonName    = g.UserMatch.Season!.Name,
                g.RosterPlayerId,
                PlayerFirst   = g.RosterPlayer!.FirstName,
                PlayerSurname = g.RosterPlayer.Surname,
                Position      = g.RosterPlayer.Position,
                g.GoalType,
                g.Count
            })
            .ToListAsync();

        // ─── 2. User penalties ────────────────────────────────────────────────
        var penalties = await _db.UserMatchPenalties
            .AsNoTracking()
            .Where(p => p.UserMatch!.UserId == userId
                     && p.UserMatch.Match!.CompletionType != CompletionType.None
                     && p.UserMatch.Match.CompletionType != CompletionType.InProgress)
            .Select(p => new
            {
                MatchId       = p.UserMatch!.MatchId,
                MatchDate     = p.UserMatch.Match!.MatchDate,
                SeasonId      = p.UserMatch.SeasonId,
                SeasonName    = p.UserMatch.Season!.Name,
                p.RosterPlayerId,
                PlayerFirst   = p.RosterPlayer!.FirstName,
                PlayerSurname = p.RosterPlayer.Surname,
                Position      = p.RosterPlayer.Position,
                p.Count
            })
            .ToListAsync();

        // ─── 3. User points ───────────────────────────────────────────────────
        var points = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.UserMatch!.UserId == userId
                     && p.UserMatch.Match!.CompletionType != CompletionType.None
                     && p.UserMatch.Match.CompletionType != CompletionType.InProgress)
            .Select(p => new
            {
                MatchId         = p.UserMatch!.MatchId,
                MatchDate       = p.UserMatch.Match!.MatchDate,
                SeasonId        = p.UserMatch.SeasonId,
                SeasonName      = p.UserMatch.Season!.Name,
                PointType       = p.PointReason!.PointType,
                PointReasonName = p.PointReason.Name,
                p.Count
            })
            .ToListAsync();

        // ─── 3b. User matches ──────────────────────────────────────────────────
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Where(um => um.UserId == userId
                      && um.Match!.CompletionType != CompletionType.None
                      && um.Match.CompletionType != CompletionType.InProgress)
            .Select(um => new
            {
                um.MatchId,
                um.SeasonId,
                SeasonName = um.Season!.Name,
                MatchDate  = um.Match!.MatchDate
            })
            .ToListAsync();

        // ─── 4. All bets (all users, for competitive bet achievements) ────────
        // Load flat (SQLite doesn't support APPLY for nested collection projections).
        var allLegRows = await _db.BetLegs
            .AsNoTracking()
            .Where(l => l.Bet!.Status != BetStatus.Cancelled
                     && l.Match!.CompletionType != CompletionType.None
                     && l.Match.CompletionType != CompletionType.InProgress
                     && completeSeasonIds.Contains(l.Match.SeasonId))
            .Select(l => new
            {
                l.BetId,
                CreatedBy = l.Bet!.CreatedBy,
                Status    = l.Bet!.Status,
                Stake     = l.Bet!.Stake,
                l.MatchId,
                SeasonId  = l.Match!.SeasonId
            })
            .ToListAsync();

        var allBets = allLegRows
            .GroupBy(r => r.BetId)
            .Select(g => new
            {
                CreatedBy = g.First().CreatedBy,
                Status    = g.First().Status,
                Stake     = g.First().Stake,
                SeasonIds = g.Select(r => r.SeasonId).Distinct().ToList(),
                MatchIds  = g.Select(r => r.MatchId).Distinct().ToList()
            })
            .ToList();

        // Resolve ApplicationUser.Id (string) → domain UserId (int)
        var userCreatedBy = await _db.Set<ApplicationUser>()
            .AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => u.Id)
            .FirstOrDefaultAsync();

        // ─── 4b. User's own bets with odds and legs ────────────────────────────
        var userLegRows = userCreatedBy == null ? [] : await _db.BetLegs
            .AsNoTracking()
            .Where(l => l.Bet!.CreatedBy == userCreatedBy
                     && l.Bet.Status != BetStatus.Cancelled)
            .Select(l => new
            {
                l.BetId,
                Status      = l.Bet!.Status,
                Stake       = l.Bet!.Stake,
                TotalOdds   = l.Bet!.TotalOdds,
                CreatedOn   = l.Bet!.CreatedOn,
                EvaluatedOn = l.Bet!.EvaluatedOn,
                l.MatchId,
                MatchDate   = l.Match != null ? l.Match.MatchDate : (DateTime?)null,
                SeasonId    = l.Match != null ? l.Match.SeasonId : 0
            })
            .ToListAsync();

        var userBets = userLegRows
            .GroupBy(r => r.BetId)
            .Select(g => new
            {
                BetId       = g.Key,
                Status      = g.First().Status,
                Stake       = g.First().Stake,
                TotalOdds   = g.First().TotalOdds,
                CreatedOn   = g.First().CreatedOn,
                EvaluatedOn = g.First().EvaluatedOn,
                LegsCount   = g.Count(),
                MatchIds    = g.Select(r => r.MatchId).Distinct().ToList(),
                SeasonIds   = g.Where(r => r.SeasonId > 0).Select(r => r.SeasonId).Distinct().ToList(),
                MatchDate   = g.OrderBy(r => r.MatchDate).Select(r => r.MatchDate).FirstOrDefault()
            })
            .OrderBy(b => b.EvaluatedOn ?? b.CreatedOn)
            .ToList();

        // ─── 4c. Season users & match counts (for Lady Byng) ───────────────────
        var seasonUserRows = await _db.SeasonUsers
            .AsNoTracking()
            .Where(su => completeSeasonIds.Contains(su.SeasonId))
            .Select(su => new { su.SeasonId, su.UserId })
            .ToListAsync();

        var userMatchCountsPerSeason = await _db.UserMatches
            .AsNoTracking()
            .Where(um => completeSeasonIds.Contains(um.SeasonId)
                      && um.Match!.CompletionType != CompletionType.None
                      && um.Match.CompletionType != CompletionType.InProgress)
            .GroupBy(um => new { um.UserId, um.SeasonId })
            .Select(g => new { g.Key.UserId, g.Key.SeasonId, Count = g.Count() })
            .ToDictionaryAsync(g => (g.UserId, g.SeasonId), g => g.Count);

        var allUserMatchesForWeeks = await _db.UserMatches
            .AsNoTracking()
            .Where(um => completeSeasonIds.Contains(um.SeasonId)
                      && um.Match!.CompletionType != CompletionType.None
                      && um.Match.CompletionType != CompletionType.InProgress)
            .Select(um => new { um.UserId, um.SeasonId, um.MatchId })
            .ToListAsync();

        // ─── 7. All-user per-season totals (competitive achievements) ─────────
        var allGoalRows = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch!.Match!.CompletionType != CompletionType.None
                     && g.UserMatch.Match.CompletionType != CompletionType.InProgress
                     && completeSeasonIds.Contains(g.UserMatch.SeasonId))
            .Select(g => new { UserId = g.UserMatch!.UserId, SeasonId = g.UserMatch!.SeasonId, g.Count })
            .ToListAsync();
        var allGoalTotals = allGoalRows
            .GroupBy(g => (g.UserId, g.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        var allPenaltyRows = await _db.UserMatchPenalties
            .AsNoTracking()
            .Where(p => p.UserMatch!.Match!.CompletionType != CompletionType.None
                     && p.UserMatch.Match.CompletionType != CompletionType.InProgress
                     && completeSeasonIds.Contains(p.UserMatch.SeasonId))
            .Select(p => new { UserId = p.UserMatch!.UserId, SeasonId = p.UserMatch!.SeasonId, p.Count })
            .ToListAsync();
        var allPenaltyTotals = allPenaltyRows
            .GroupBy(p => (p.UserId, p.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        var allPlusRows = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.PointReason!.PointType == PointType.Positive
                     && p.UserMatch!.Match!.CompletionType != CompletionType.None
                     && p.UserMatch.Match.CompletionType != CompletionType.InProgress
                     && completeSeasonIds.Contains(p.UserMatch.SeasonId))
            .Select(p => new { UserId = p.UserMatch!.UserId, SeasonId = p.UserMatch!.SeasonId, p.Count })
            .ToListAsync();
        var allPlusTotals = allPlusRows
            .GroupBy(p => (p.UserId, p.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        var allMinusRows = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.PointReason!.PointType == PointType.Negative
                     && p.UserMatch!.Match!.CompletionType != CompletionType.None
                     && p.UserMatch.Match.CompletionType != CompletionType.InProgress
                     && completeSeasonIds.Contains(p.UserMatch.SeasonId))
            .Select(p => new
            {
                UserId   = p.UserMatch!.UserId,
                SeasonId = p.UserMatch!.SeasonId,
                MatchId  = p.UserMatch!.MatchId,
                p.Count
            })
            .ToListAsync();
        var allMinusTotals = allMinusRows
            .GroupBy(p => (p.UserId, p.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        // ─── 8. Season names ──────────────────────────────────────────────────
        var seasonNames = await _db.Seasons
            .AsNoTracking()
            .Select(s => new { s.Id, s.Name })
            .ToDictionaryAsync(s => s.Id, s => s.Name);

        // ─── 9. Global week map (matchId → week number within its season) ─────
        var relevantSeasonIds = goals.Select(g => g.SeasonId)
            .Concat(penalties.Select(p => p.SeasonId))
            .Concat(points.Select(p => p.SeasonId))
            .Concat(userMatches.Select(um => um.SeasonId))
            .Concat(completeSeasonIds)
            .Distinct().ToList();

        var weekMap = new Dictionary<int, int>();
        var seasonTotalWeeks = new Dictionary<int, HashSet<int>>();
        var matchNumberMap = new Dictionary<int, int>();
        if (relevantSeasonIds.Count > 0)
        {
            var matchRows = await _db.Matches
                .AsNoTracking()
                .Where(m => relevantSeasonIds.Contains(m.SeasonId) && m.MatchDate.HasValue)
                .Select(m => new { m.Id, m.SeasonId, m.MatchNumber, Date = m.MatchDate!.Value.Date })
                .ToListAsync();

            foreach (var sg in matchRows.GroupBy(m => m.SeasonId))
            {
                var dateToWeek = sg.Select(m => m.Date).Distinct().OrderBy(d => d)
                    .Select((d, i) => (d, week: i + 1))
                    .ToDictionary(x => x.d, x => x.week);
                seasonTotalWeeks[sg.Key] = new HashSet<int>(dateToWeek.Values);
                foreach (var m in sg)
                {
                    weekMap.TryAdd(m.Id, dateToWeek[m.Date]);
                    matchNumberMap.TryAdd(m.Id, m.MatchNumber);
                }
            }
        }

        // ─── Occurrence helper ────────────────────────────────────────────────
        AchievementOccurrenceDto O(
            int? matchId, DateTime? on, int? week, int? sid, string? sName, string? player, int? val, int? matchNumber = null)
            => new(matchId, on, week, sid, sName, player, val, matchNumber ?? (matchId.HasValue && matchNumberMap.TryGetValue(matchId.Value, out var mn) ? mn : null));

        // ─── Match-level goal achievements ────────────────────────────────────

        AchievementResultDto Sniper()
        {
            var occs = goals
                .GroupBy(g => g.MatchId)
                .SelectMany(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return mg.GroupBy(g => g.RosterPlayerId)
                        .Where(pg => pg.Sum(g => g.Count) >= 3)
                        .Select(pg => O(mg.Key, mg.First().MatchDate, w,
                            mg.First().SeasonId, mg.First().SeasonName,
                            $"{pg.First().PlayerFirst} {pg.First().PlayerSurname}",
                            pg.Sum(g => g.Count)));
                }).ToList();
            return MatchResult("sniper", occs);
        }

        AchievementResultDto Domination()
        {
            var occs = goals
                .GroupBy(g => g.MatchId)
                .Where(mg => mg.Sum(g => g.Count) >= 4 && mg.Select(g => g.RosterPlayerId).Distinct().Count() >= 2)
                .Select(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return O(mg.Key, mg.First().MatchDate, w,
                        mg.First().SeasonId, mg.First().SeasonName,
                        null, mg.Sum(g => g.Count));
                }).ToList();
            return MatchResult("domination", occs);
        }

        AchievementResultDto Shorty()
        {
            var occs = goals
                .Where(g => g.GoalType == GoalType.ShortHanded)
                .GroupBy(g => g.MatchId)
                .Where(mg => mg.Sum(g => g.Count) >= 3)
                .Select(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return O(mg.Key, mg.First().MatchDate, w,
                        mg.First().SeasonId, mg.First().SeasonName,
                        null, mg.Sum(g => g.Count));
                }).ToList();
            return MatchResult("shorty", occs);
        }

        // ─── Week-level goal achievements ─────────────────────────────────────

        AchievementResultDto GodMode()
        {
            var occs = goals
                .Where(g => g.Position != null && ForwardPositions.Contains(g.Position) && weekMap.ContainsKey(g.MatchId))
                .GroupBy(g => (g.SeasonId, Week: weekMap[g.MatchId]))
                .Where(wg => wg.Sum(g => g.Count) >= 10)
                .Select(wg =>
                {
                    var first = wg.OrderBy(g => g.MatchDate).First();
                    return O(null, first.MatchDate, wg.Key.Week,
                        wg.Key.SeasonId, first.SeasonName, null, wg.Sum(g => g.Count));
                }).ToList();
            return WeekResult("god_mode", occs);
        }

        AchievementResultDto BlueLineSnipers()
        {
            var occs = goals
                .Where(g => g.Position != null && g.Position.Equals("D", StringComparison.OrdinalIgnoreCase) && weekMap.ContainsKey(g.MatchId))
                .GroupBy(g => (g.SeasonId, Week: weekMap[g.MatchId]))
                .Where(wg => wg.Sum(g => g.Count) >= 5)
                .Select(wg =>
                {
                    var first = wg.OrderBy(g => g.MatchDate).First();
                    return O(null, first.MatchDate, wg.Key.Week,
                        wg.Key.SeasonId, first.SeasonName, null, wg.Sum(g => g.Count));
                }).ToList();
            return WeekResult("blue_line_snipers", occs);
        }

        // ─── Season-level goal achievements ───────────────────────────────────

        AchievementResultDto MassiveAttack()
        {
            var occs = goals
                .Where(g => completeSeasonIds.Contains(g.SeasonId)
                         && g.Position != null && ForwardPositions.Contains(g.Position))
                .GroupBy(g => g.SeasonId)
                .Where(sg => sg.Sum(g => g.Count) >= 140)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(g => g.Count)))
                .ToList();
            return SeasonResult("massive_attack", occs);
        }

        AchievementResultDto OffensiveDefenseman()
        {
            var occs = goals
                .Where(g => completeSeasonIds.Contains(g.SeasonId)
                         && g.Position != null && g.Position.Equals("D", StringComparison.OrdinalIgnoreCase))
                .GroupBy(g => g.SeasonId)
                .Where(sg => sg.Sum(g => g.Count) >= 45)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(g => g.Count)))
                .ToList();
            return SeasonResult("offensive_defenseman", occs);
        }

        AchievementResultDto PlayerLover()
        {
            var occs = goals
                .Where(g => completeSeasonIds.Contains(g.SeasonId))
                .GroupBy(g => g.SeasonId)
                .SelectMany(sg =>
                    sg.GroupBy(g => g.RosterPlayerId)
                        .Where(pg => pg.Sum(g => g.Count) >= 70)
                        .Select(pg => O(null, null, null, sg.Key, sg.First().SeasonName,
                            $"{pg.First().PlayerFirst} {pg.First().PlayerSurname}",
                            pg.Sum(g => g.Count))))
                .ToList();
            return SeasonResult("player_lover", occs);
        }

        // ─── Competitive season goal achievement ──────────────────────────────

        AchievementResultDto GoldenStick()
        {
            var occs = allGoalTotals
                .GroupBy(x => x.SeasonId)
                .SelectMany(sg =>
                {
                    var max = sg.Max(x => x.Total);
                    if (max <= 0) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var entry = sg.FirstOrDefault(x => x.UserId == userId);
                    if (entry.UserId == 0 || entry.Total < max) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var sName = seasonNames.TryGetValue(sg.Key, out var n) ? n : null;
                    return new[] { O(null, null, null, sg.Key, sName, null, entry.Total) };
                }).ToList();
            return SeasonResult("golden_stick", occs);
        }

        // ─── Match-level penalty achievements ─────────────────────────────────

        AchievementResultDto SinBinVip()
        {
            var occs = penalties
                .GroupBy(p => p.MatchId)
                .SelectMany(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return mg.GroupBy(p => p.RosterPlayerId)
                        .Where(pg => pg.Sum(p => p.Count) >= 3)
                        .Select(pg => O(mg.Key, mg.First().MatchDate, w,
                            mg.First().SeasonId, mg.First().SeasonName,
                            $"{pg.First().PlayerFirst} {pg.First().PlayerSurname}",
                            pg.Sum(p => p.Count)));
                }).ToList();
            return MatchResult("sin_bin_vip", occs);
        }

        AchievementResultDto BroadStreetBully()
        {
            var occs = penalties
                .GroupBy(p => p.MatchId)
                .Where(mg => mg.Sum(p => p.Count) >= 4 && mg.Select(p => p.RosterPlayerId).Distinct().Count() >= 2)
                .Select(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return O(mg.Key, mg.First().MatchDate, w,
                        mg.First().SeasonId, mg.First().SeasonName,
                        null, mg.Sum(p => p.Count));
                }).ToList();
            return MatchResult("broad_street_bully", occs);
        }

        // ─── Week-level penalty achievement ───────────────────────────────────

        AchievementResultDto DisciplinaryHearing()
        {
            var occs = penalties
                .Where(p => weekMap.ContainsKey(p.MatchId))
                .GroupBy(p => (p.SeasonId, Week: weekMap[p.MatchId]))
                .Where(wg => wg.Sum(p => p.Count) >= 5)
                .Select(wg =>
                {
                    var first = wg.OrderBy(p => p.MatchDate).First();
                    return O(null, first.MatchDate, wg.Key.Week,
                        wg.Key.SeasonId, first.SeasonName, null, wg.Sum(p => p.Count));
                }).ToList();
            return WeekResult("disciplinary_hearing", occs);
        }

        // ─── Season-level penalty achievements ────────────────────────────────

        AchievementResultDto TheEnforcer()
        {
            var occs = penalties
                .Where(p => completeSeasonIds.Contains(p.SeasonId))
                .GroupBy(p => p.SeasonId)
                .SelectMany(sg =>
                    sg.GroupBy(p => p.RosterPlayerId)
                        .Where(pg => pg.Sum(p => p.Count) >= 15)
                        .Select(pg => O(null, null, null, sg.Key, sg.First().SeasonName,
                            $"{pg.First().PlayerFirst} {pg.First().PlayerSurname}",
                            pg.Sum(p => p.Count))))
                .ToList();
            return SeasonResult("the_enforcer", occs);
        }

        AchievementResultDto GoonSquad()
        {
            var occs = penalties
                .Where(p => completeSeasonIds.Contains(p.SeasonId))
                .GroupBy(p => p.SeasonId)
                .Where(sg => sg.Sum(p => p.Count) >= 40)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(p => p.Count)))
                .ToList();
            return SeasonResult("goon_squad", occs);
        }

        // ─── Competitive season penalty achievement ───────────────────────────

        AchievementResultDto Jailbird()
        {
            var occs = allPenaltyTotals
                .GroupBy(x => x.SeasonId)
                .SelectMany(sg =>
                {
                    var max = sg.Max(x => x.Total);
                    if (max <= 0) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var entry = sg.FirstOrDefault(x => x.UserId == userId);
                    if (entry.UserId == 0 || entry.Total < max) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var sName = seasonNames.TryGetValue(sg.Key, out var n) ? n : null;
                    return new[] { O(null, null, null, sg.Key, sName, null, entry.Total) };
                }).ToList();
            return SeasonResult("jailbird", occs);
        }

        // ─── Match-level minus point achievement ──────────────────────────────

        AchievementResultDto Unlucky()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Negative)
                .GroupBy(p => p.MatchId)
                .Where(mg => mg.Sum(p => p.Count) >= 3)
                .Select(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return O(mg.Key, mg.First().MatchDate, w,
                        mg.First().SeasonId, mg.First().SeasonName,
                        null, mg.Sum(p => p.Count));
                }).ToList();
            return MatchResult("unlucky", occs);
        }

        // ─── Week-level minus point achievement ───────────────────────────────

        AchievementResultDto DeepPockets()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Negative && weekMap.ContainsKey(p.MatchId))
                .GroupBy(p => (p.SeasonId, Week: weekMap[p.MatchId]))
                .Where(wg => wg.Sum(p => p.Count) >= 6)
                .Select(wg =>
                {
                    var first = wg.OrderBy(p => p.MatchDate).First();
                    return O(null, first.MatchDate, wg.Key.Week,
                        wg.Key.SeasonId, first.SeasonName, null, wg.Sum(p => p.Count));
                }).ToList();
            return WeekResult("deep_pockets", occs);
        }

        // ─── Season-level minus point achievement ─────────────────────────────

        AchievementResultDto VipSponzor()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Negative && completeSeasonIds.Contains(p.SeasonId))
                .GroupBy(p => p.SeasonId)
                .Where(sg => sg.Sum(p => p.Count) >= 36)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(p => p.Count)))
                .ToList();
            return SeasonResult("vip_sponzor", occs);
        }

        // ─── Competitive season minus point achievement ───────────────────────

        AchievementResultDto TheAtm()
        {
            var occs = allMinusTotals
                .GroupBy(x => x.SeasonId)
                .SelectMany(sg =>
                {
                    var max = sg.Max(x => x.Total);
                    if (max <= 0) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var entry = sg.FirstOrDefault(x => x.UserId == userId);
                    if (entry.UserId == 0 || entry.Total < max) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var sName = seasonNames.TryGetValue(sg.Key, out var n) ? n : null;
                    return new[] { O(null, null, null, sg.Key, sName, null, entry.Total) };
                }).ToList();
            return SeasonResult("the_atm", occs);
        }

        // ─── Match-level plus point achievement ───────────────────────────────

        AchievementResultDto IceGeneral()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Positive)
                .GroupBy(p => p.MatchId)
                .Where(mg => mg.Sum(p => p.Count) >= 3)
                .Select(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return O(mg.Key, mg.First().MatchDate, w,
                        mg.First().SeasonId, mg.First().SeasonName,
                        null, mg.Sum(p => p.Count));
                }).ToList();
            return MatchResult("ice_general", occs);
        }

        // ─── Week-level plus point achievement ────────────────────────────────

        AchievementResultDto GoodWeek()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Positive && weekMap.ContainsKey(p.MatchId))
                .GroupBy(p => (p.SeasonId, Week: weekMap[p.MatchId]))
                .Where(wg => wg.Sum(p => p.Count) >= 5)
                .Select(wg =>
                {
                    var first = wg.OrderBy(p => p.MatchDate).First();
                    return O(null, first.MatchDate, wg.Key.Week,
                        wg.Key.SeasonId, first.SeasonName, null, wg.Sum(p => p.Count));
                }).ToList();
            return WeekResult("good_week", occs);
        }

        // ─── Season-level plus point achievement ──────────────────────────────

        AchievementResultDto HappySeason()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Positive && completeSeasonIds.Contains(p.SeasonId))
                .GroupBy(p => p.SeasonId)
                .Where(sg => sg.Sum(p => p.Count) >= 25)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(p => p.Count)))
                .ToList();
            return SeasonResult("happy_season", occs);
        }

        // ─── Competitive season plus point achievement ────────────────────────

        AchievementResultDto KingOfTheRink()
        {
            var occs = allPlusTotals
                .GroupBy(x => x.SeasonId)
                .SelectMany(sg =>
                {
                    var max = sg.Max(x => x.Total);
                    if (max <= 0) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var entry = sg.FirstOrDefault(x => x.UserId == userId);
                    if (entry.UserId == 0 || entry.Total < max) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var sName = seasonNames.TryGetValue(sg.Key, out var n) ? n : null;
                    return new[] { O(null, null, null, sg.Key, sName, null, entry.Total) };
                }).ToList();
            return SeasonResult("king_of_the_rink", occs);
        }

        // ─── Bet achievements ─────────────────────────────────────────────────

        AchievementResultDto Oracle()
        {
            if (userCreatedBy == null) return new("oracle", false, 0, 0, 0, 1, []);

            var flat = allBets
                .SelectMany(b => b.SeasonIds.Select(sid => (b.CreatedBy, b.Stake, SeasonId: sid)))
                .ToList();

            var occs = flat
                .GroupBy(x => x.SeasonId)
                .SelectMany(sg =>
                {
                    var maxStake = sg.Max(x => x.Stake);
                    if (maxStake <= 0) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var userMaxStake = sg.Where(x => x.CreatedBy == userCreatedBy)
                        .Select(x => x.Stake).DefaultIfEmpty(0m).Max();
                    if (userMaxStake < maxStake) return Enumerable.Empty<AchievementOccurrenceDto>();
                    var sName = seasonNames.TryGetValue(sg.Key, out var n) ? n : null;
                    return new[] { O(null, null, null, sg.Key, sName, null, (int)Math.Floor(userMaxStake)) };
                }).ToList();
            return SeasonResult("oracle", occs);
        }

        AchievementResultDto TheBookie()
        {
            if (userCreatedBy == null) return new("the_bookie", false, 0, 0, 0, 1, []);

            var flat = allBets
                .Where(b => b.Status == BetStatus.Won)
                .SelectMany(b => b.SeasonIds.Select(sid => (b.CreatedBy, SeasonId: sid)))
                .ToList();

            var occs = flat
                .GroupBy(x => x.SeasonId)
                .SelectMany(sg =>
                {
                    var countsByUser = sg.GroupBy(x => x.CreatedBy)
                        .ToDictionary(g => g.Key, g => g.Count());
                    var maxCount = countsByUser.Values.DefaultIfEmpty(0).Max();
                    if (maxCount <= 0) return Enumerable.Empty<AchievementOccurrenceDto>();
                    if (!countsByUser.TryGetValue(userCreatedBy!, out var userCount) || userCount < maxCount)
                        return Enumerable.Empty<AchievementOccurrenceDto>();
                    var sName = seasonNames.TryGetValue(sg.Key, out var n) ? n : null;
                    return new[] { O(null, null, null, sg.Key, sName, null, userCount) };
                }).ToList();
            return SeasonResult("the_bookie", occs);
        }

        AchievementResultDto Nostradamus()
        {
            if (userCreatedBy == null) return new("nostradamus", false, 0, 0, 0, 1, []);

            var occs = allBets
                .Where(b => b.CreatedBy == userCreatedBy && b.Stake >= 3)
                .Select(b =>
                {
                    var sid = b.SeasonIds.FirstOrDefault();
                    var sName = sid > 0 && seasonNames.TryGetValue(sid, out var n) ? n : null;
                    return O(null, null, null, sid > 0 ? (int?)sid : null, sName, null, (int)Math.Floor(b.Stake));
                }).ToList();
            return MatchResult("nostradamus", occs);
        }

        // ─── Combo achievement ────────────────────────────────────────────────

        AchievementResultDto SwissArmyKnife()
        {
            if (userCreatedBy == null) return new("swiss_army_knife", false, 0, 0, 0, 1, []);

            var goalMatchSet    = goals.Select(g => g.MatchId).ToHashSet();
            var penaltyMatchSet = penalties.Select(p => p.MatchId).ToHashSet();
            var wonBetMatchSet  = userBets
                .Where(b => b.Status == BetStatus.Won)
                .SelectMany(b => b.MatchIds)
                .ToHashSet();

            var matchContext = goals
                .GroupBy(g => g.MatchId)
                .ToDictionary(g => g.Key, g => g.First());

            var occs = goalMatchSet
                .Intersect(penaltyMatchSet)
                .Intersect(wonBetMatchSet)
                .Select(matchId =>
                {
                    matchContext.TryGetValue(matchId, out var ctx);
                    weekMap.TryGetValue(matchId, out var w);
                    return O(matchId, ctx?.MatchDate, w, ctx?.SeasonId, ctx?.SeasonName, null, null);
                }).ToList();
            return MatchResult("swiss_army_knife", occs);
        }

        // ─── New achievements ─────────────────────────────────────────────────

        AchievementResultDto PowerPlayMaestro()
        {
            var occs = goals
                .Where(g => g.GoalType == GoalType.PowerPlay && weekMap.ContainsKey(g.MatchId))
                .GroupBy(g => (g.SeasonId, Week: weekMap[g.MatchId]))
                .Where(wg => wg.Sum(g => g.Count) >= 3)
                .Select(wg =>
                {
                    var first = wg.OrderBy(g => g.MatchDate).First();
                    return O(null, first.MatchDate, wg.Key.Week,
                        wg.Key.SeasonId, first.SeasonName, null, wg.Sum(g => g.Count));
                }).ToList();
            return WeekResult("power_play_maestro", occs);
        }

        AchievementResultDto StreakMaster()
        {
            var userMatchesByWeek = userMatches
                .Where(um => weekMap.ContainsKey(um.MatchId))
                .GroupBy(um => (um.SeasonId, Week: weekMap[um.MatchId]))
                .Where(wg => wg.Select(um => um.MatchId).Distinct().Count() >= 4)
                .ToList();

            var occs = new List<AchievementOccurrenceDto>();
            foreach (var wg in userMatchesByWeek)
            {
                var matchIds = wg.Select(um => um.MatchId).Distinct().ToList();
                var scoredAll = matchIds.All(mid => goals.Any(g => g.MatchId == mid && g.Count > 0));
                if (scoredAll)
                {
                    var first = wg.OrderBy(um => um.MatchDate).First();
                    occs.Add(O(null, first.MatchDate, wg.Key.Week,
                        wg.Key.SeasonId, first.SeasonName, null, matchIds.Count));
                }
            }
            return WeekResult("streak_master", occs);
        }

        AchievementResultDto GuardianAngel()
        {
            var occs = new List<AchievementOccurrenceDto>();
            foreach (var sid in completeSeasonIds)
            {
                var seasonMatches = allUserMatchesForWeeks
                    .Where(um => um.SeasonId == sid && weekMap.ContainsKey(um.MatchId))
                    .ToList();

                var userWeekMatches = seasonMatches
                    .GroupBy(um => (um.UserId, Week: weekMap[um.MatchId]))
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(um => um.MatchId).Distinct().Count()
                    );

                var userWeekMinuses = allMinusRows
                    .Where(p => p.SeasonId == sid && weekMap.ContainsKey(p.MatchId))
                    .GroupBy(p => (p.UserId, Week: weekMap[p.MatchId]))
                    .ToDictionary(
                        g => g.Key,
                        g => g.Sum(p => p.Count)
                    );

                var userCleanWeeks = seasonMatches
                    .Select(um => um.UserId)
                    .Distinct()
                    .ToDictionary(
                        uid => uid,
                        uid => userWeekMatches
                            .Where(kvp => kvp.Key.UserId == uid && kvp.Value >= 4)
                            .Count(kvp => !userWeekMinuses.TryGetValue(kvp.Key, out var minuses) || minuses == 0)
                    );

                if (userCleanWeeks.Count == 0) continue;

                var maxCleanWeeks = userCleanWeeks.Values.Max();
                if (maxCleanWeeks <= 0) continue;

                if (userCleanWeeks.TryGetValue(userId, out var userWeeks) && userWeeks == maxCleanWeeks)
                {
                    var sName = seasonNames.TryGetValue(sid, out var n) ? n : null;
                    var firstMatch = userMatches.Where(um => um.SeasonId == sid).OrderBy(um => um.MatchDate).FirstOrDefault();
                    occs.Add(O(null, firstMatch?.MatchDate, null, sid, sName, null, userWeeks));
                }
            }
            return SeasonResult("guardian_angel", occs);
        }

        AchievementResultDto LadyByng()
        {
            var occs = new List<AchievementOccurrenceDto>();
            foreach (var sid in completeSeasonIds)
            {
                var seasonTotalPenalties = allPenaltyTotals.Where(x => x.SeasonId == sid).Sum(x => x.Total);
                if (seasonTotalPenalties == 0) continue;

                var activeUserIds = seasonUserRows
                    .Where(su => su.SeasonId == sid)
                    .Select(su => su.UserId)
                    .Where(uid => userMatchCountsPerSeason.TryGetValue((uid, sid), out var cnt) && cnt >= 5)
                    .Distinct()
                    .ToList();

                if (!activeUserIds.Contains(userId)) continue;

                var penaltiesByUser = activeUserIds.ToDictionary(
                    uid => uid,
                    uid => allPenaltyTotals.Where(x => x.UserId == uid && x.SeasonId == sid).Sum(x => x.Total)
                );

                if (penaltiesByUser.Count == 0) continue;

                var minPenalties = penaltiesByUser.Values.Min();
                var userPenalties = penaltiesByUser[userId];

                if (userPenalties == minPenalties)
                {
                    var sName = seasonNames.TryGetValue(sid, out var n) ? n : null;
                    var firstMatch = userMatches.Where(um => um.SeasonId == sid).OrderBy(um => um.MatchDate).FirstOrDefault();
                    occs.Add(O(null, firstMatch?.MatchDate, null, sid, sName, null, userPenalties));
                }
            }
            return SeasonResult("lady_byng", occs);
        }

        AchievementResultDto OwnGoalDisaster()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Negative
                         && (p.PointReasonName.Contains("own goal", StringComparison.OrdinalIgnoreCase)
                          || p.PointReasonName.Contains("error in defense", StringComparison.OrdinalIgnoreCase)))
                .GroupBy(p => p.MatchId)
                .Select(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    var first = mg.First();
                    return O(mg.Key, first.MatchDate, w, first.SeasonId, first.SeasonName, null, mg.Sum(p => p.Count));
                }).ToList();
            return MatchResult("own_goal_disaster", occs);
        }

        AchievementResultDto ThePerfectGame()
        {
            var wonBetMatchIds = userBets
                .Where(b => b.Status == BetStatus.Won)
                .SelectMany(b => b.MatchIds)
                .ToHashSet();

            var occs = userMatches
                .GroupBy(um => um.MatchId)
                .Where(mg =>
                {
                    var mid = mg.Key;
                    var hasGoal = goals.Any(g => g.MatchId == mid && g.Count > 0);
                    var noPenalty = !penalties.Any(p => p.MatchId == mid && p.Count > 0);
                    var noMinus = !points.Any(p => p.MatchId == mid && p.PointType == PointType.Negative && p.Count > 0);
                    var wonBet = wonBetMatchIds.Contains(mid);
                    return hasGoal && noPenalty && noMinus && wonBet;
                })
                .Select(mg =>
                {
                    var first = mg.First();
                    weekMap.TryGetValue(mg.Key, out var w);
                    return O(mg.Key, first.MatchDate, w, first.SeasonId, first.SeasonName, null, null);
                }).ToList();
            return MatchResult("the_perfect_game", occs);
        }

        AchievementResultDto ParlayMaster()
        {
            var occs = userBets
                .Where(b => b.Status == BetStatus.Won && b.LegsCount >= 3)
                .Select(b =>
                {
                    var sid = b.SeasonIds.FirstOrDefault();
                    var sName = sid > 0 && seasonNames.TryGetValue(sid, out var n) ? n : null;
                    return O(b.MatchIds.FirstOrDefault(), b.MatchDate ?? b.EvaluatedOn ?? b.CreatedOn, null,
                        sid > 0 ? (int?)sid : null, sName, null, b.LegsCount);
                }).ToList();
            return MatchResult("parlay_master", occs);
        }

        AchievementResultDto UnderdogKing()
        {
            var occs = userBets
                .Where(b => b.Status == BetStatus.Won && b.TotalOdds >= 4.0m)
                .Select(b =>
                {
                    var sid = b.SeasonIds.FirstOrDefault();
                    var sName = sid > 0 && seasonNames.TryGetValue(sid, out var n) ? n : null;
                    return O(b.MatchIds.FirstOrDefault(), b.MatchDate ?? b.EvaluatedOn ?? b.CreatedOn, null,
                        sid > 0 ? (int?)sid : null, sName, null, (int)Math.Round(b.TotalOdds));
                }).ToList();
            return MatchResult("underdog_king", occs);
        }

        AchievementResultDto HotStreak()
        {
            var evaluatedBets = userBets
                .Where(b => b.Status == BetStatus.Won || b.Status == BetStatus.Lost)
                .OrderBy(b => b.EvaluatedOn ?? b.CreatedOn)
                .ToList();

            var occs = new List<AchievementOccurrenceDto>();
            int currentStreak = 0;
            foreach (var b in evaluatedBets)
            {
                if (b.Status == BetStatus.Won)
                {
                    currentStreak++;
                    if (currentStreak >= 5)
                    {
                        var sid = b.SeasonIds.FirstOrDefault();
                        var sName = sid > 0 && seasonNames.TryGetValue(sid, out var n) ? n : null;
                        occs.Add(O(b.MatchIds.FirstOrDefault(), b.MatchDate ?? b.EvaluatedOn ?? b.CreatedOn, null,
                            sid > 0 ? (int?)sid : null, sName, null, currentStreak));
                    }
                }
                else
                {
                    currentStreak = 0;
                }
            }
            return MatchResult("hot_streak", occs);
        }

        AchievementResultDto IronMan()
        {
            var occs = new List<AchievementOccurrenceDto>();
            foreach (var sid in completeSeasonIds)
            {
                var userWeekCounts = allUserMatchesForWeeks
                    .Where(um => um.SeasonId == sid && weekMap.ContainsKey(um.MatchId))
                    .GroupBy(um => um.UserId)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(um => weekMap[um.MatchId]).Distinct().Count()
                    );

                if (userWeekCounts.Count == 0) continue;

                var maxWeeks = userWeekCounts.Values.Max();
                if (maxWeeks <= 0) continue;

                if (userWeekCounts.TryGetValue(userId, out var userWeeks) && userWeeks == maxWeeks)
                {
                    var sName = seasonNames.TryGetValue(sid, out var n) ? n : null;
                    var firstMatch = userMatches.Where(um => um.SeasonId == sid).OrderBy(um => um.MatchDate).FirstOrDefault();
                    occs.Add(O(null, firstMatch?.MatchDate, null, sid, sName, null, userWeeks));
                }
            }
            return SeasonResult("iron_man", occs);
        }

        // ─── Assemble result ──────────────────────────────────────────────────
        return new UserAchievementsDto(new[]
        {
            Sniper(), Domination(), Shorty(),
            GodMode(), BlueLineSnipers(),
            MassiveAttack(), OffensiveDefenseman(), PlayerLover(), GoldenStick(),
            PowerPlayMaestro(), StreakMaster(),
            SinBinVip(), BroadStreetBully(),
            DisciplinaryHearing(),
            TheEnforcer(), GoonSquad(), Jailbird(), LadyByng(),
            Unlucky(), DeepPockets(), VipSponzor(), TheAtm(),
            IceGeneral(), GoodWeek(), HappySeason(), KingOfTheRink(),
            GuardianAngel(), OwnGoalDisaster(), IronMan(),
            Oracle(), TheBookie(), Nostradamus(),
            SwissArmyKnife(), ThePerfectGame(), ParlayMaster(), UnderdogKing(), HotStreak(),
        });
    }
}
