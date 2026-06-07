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

    public AchievementService(NhlStatsDbContext db) => _db = db;

    public async Task<UserAchievementsDto> GetUserAchievementsAsync(int userId)
    {
        // ─── 1. User goals ────────────────────────────────────────────────────
        var goals = await _db.UserMatchGoals
            .AsNoTracking()
            .Where(g => g.UserMatch!.UserId == userId)
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
            .Where(p => p.UserMatch!.UserId == userId)
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
            .Where(p => p.UserMatch!.UserId == userId)
            .Select(p => new
            {
                MatchId    = p.UserMatch!.MatchId,
                MatchDate  = p.UserMatch.Match!.MatchDate,
                SeasonId   = p.UserMatch.SeasonId,
                SeasonName = p.UserMatch.Season!.Name,
                PointType  = p.PointReason!.PointType,
                p.Count
            })
            .ToListAsync();

        // ─── 4. All bets (all users, for competitive bet achievements) ────────
        // Load flat (SQLite doesn't support APPLY for nested collection projections).
        var allLegRows = await _db.BetLegs
            .AsNoTracking()
            .Where(l => l.Bet!.Status != BetStatus.Cancelled)
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
        var creatorIds = allBets.Select(b => b.CreatedBy).Distinct().ToList();
        var creatorToUserId = await _db.Set<ApplicationUser>()
            .AsNoTracking()
            .Where(u => creatorIds.Contains(u.Id) && u.UserId.HasValue)
            .ToDictionaryAsync(u => u.Id, u => u.UserId!.Value);

        var userCreatedBy = creatorToUserId
            .Where(kv => kv.Value == userId)
            .Select(kv => kv.Key)
            .FirstOrDefault();

        // ─── 5. All-user per-season totals (competitive achievements) ─────────
        var allGoalRows = await _db.UserMatchGoals
            .AsNoTracking()
            .Select(g => new { UserId = g.UserMatch!.UserId, SeasonId = g.UserMatch!.SeasonId, g.Count })
            .ToListAsync();
        var allGoalTotals = allGoalRows
            .GroupBy(g => (g.UserId, g.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        var allPenaltyRows = await _db.UserMatchPenalties
            .AsNoTracking()
            .Select(p => new { UserId = p.UserMatch!.UserId, SeasonId = p.UserMatch!.SeasonId, p.Count })
            .ToListAsync();
        var allPenaltyTotals = allPenaltyRows
            .GroupBy(p => (p.UserId, p.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        var allPlusRows = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.PointReason!.PointType == PointType.Positive)
            .Select(p => new { UserId = p.UserMatch!.UserId, SeasonId = p.UserMatch!.SeasonId, p.Count })
            .ToListAsync();
        var allPlusTotals = allPlusRows
            .GroupBy(p => (p.UserId, p.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        var allMinusRows = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.PointReason!.PointType == PointType.Negative)
            .Select(p => new { UserId = p.UserMatch!.UserId, SeasonId = p.UserMatch!.SeasonId, p.Count })
            .ToListAsync();
        var allMinusTotals = allMinusRows
            .GroupBy(p => (p.UserId, p.SeasonId))
            .Select(g => (g.Key.UserId, g.Key.SeasonId, Total: g.Sum(x => x.Count)))
            .ToList();

        // ─── 6. Season names ──────────────────────────────────────────────────
        var seasonNames = await _db.Seasons
            .AsNoTracking()
            .Select(s => new { s.Id, s.Name })
            .ToDictionaryAsync(s => s.Id, s => s.Name);

        // ─── 7. Global week map (matchId → week number within its season) ─────
        var userSeasonIds = goals.Select(g => g.SeasonId)
            .Concat(penalties.Select(p => p.SeasonId))
            .Concat(points.Select(p => p.SeasonId))
            .Distinct().ToList();

        var weekMap = new Dictionary<int, int>();
        if (userSeasonIds.Count > 0)
        {
            var matchRows = await _db.Matches
                .AsNoTracking()
                .Where(m => userSeasonIds.Contains(m.SeasonId) && m.MatchDate.HasValue)
                .Select(m => new { m.Id, m.SeasonId, Date = m.MatchDate!.Value.Date })
                .ToListAsync();

            foreach (var sg in matchRows.GroupBy(m => m.SeasonId))
            {
                var dateToWeek = sg.Select(m => m.Date).Distinct().OrderBy(d => d)
                    .Select((d, i) => (d, week: i + 1))
                    .ToDictionary(x => x.d, x => x.week);
                foreach (var m in sg)
                    weekMap.TryAdd(m.Id, dateToWeek[m.Date]);
            }
        }

        // ─── Occurrence helper ────────────────────────────────────────────────
        static AchievementOccurrenceDto O(
            int? matchId, DateTime? on, int? week, int? sid, string? sName, string? player, int? val)
            => new(matchId, on, week, sid, sName, player, val);

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
            return new("sniper", occs.Count > 0, ToMatchLevel(occs.Count), occs);
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
            return new("domination", occs.Count > 0, ToMatchLevel(occs.Count), occs);
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
            return new("shorty", occs.Count > 0, ToMatchLevel(occs.Count), occs);
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
            return new("god_mode", occs.Count > 0, ToWeekLevel(occs.Count), occs);
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
            return new("blue_line_snipers", occs.Count > 0, ToWeekLevel(occs.Count), occs);
        }

        // ─── Season-level goal achievements ───────────────────────────────────

        AchievementResultDto MassiveAttack()
        {
            var occs = goals
                .Where(g => g.Position != null && ForwardPositions.Contains(g.Position))
                .GroupBy(g => g.SeasonId)
                .Where(sg => sg.Sum(g => g.Count) >= 140)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(g => g.Count)))
                .ToList();
            return new("massive_attack", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
        }

        AchievementResultDto OffensiveDefenseman()
        {
            var occs = goals
                .Where(g => g.Position != null && g.Position.Equals("D", StringComparison.OrdinalIgnoreCase))
                .GroupBy(g => g.SeasonId)
                .Where(sg => sg.Sum(g => g.Count) >= 45)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(g => g.Count)))
                .ToList();
            return new("offensive_defenseman", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
        }

        AchievementResultDto PlayerLover()
        {
            var occs = goals
                .GroupBy(g => g.SeasonId)
                .SelectMany(sg =>
                    sg.GroupBy(g => g.RosterPlayerId)
                        .Where(pg => pg.Sum(g => g.Count) >= 70)
                        .Select(pg => O(null, null, null, sg.Key, sg.First().SeasonName,
                            $"{pg.First().PlayerFirst} {pg.First().PlayerSurname}",
                            pg.Sum(g => g.Count))))
                .ToList();
            return new("player_lover", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
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
            return new("golden_stick", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
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
            return new("sin_bin_vip", occs.Count > 0, ToMatchLevel(occs.Count), occs);
        }

        AchievementResultDto BroadStreetBully()
        {
            var occs = penalties
                .GroupBy(p => p.MatchId)
                .Where(mg => mg.Sum(p => p.Count) >= 3)
                .Select(mg =>
                {
                    weekMap.TryGetValue(mg.Key, out var w);
                    return O(mg.Key, mg.First().MatchDate, w,
                        mg.First().SeasonId, mg.First().SeasonName,
                        null, mg.Sum(p => p.Count));
                }).ToList();
            return new("broad_street_bully", occs.Count > 0, ToMatchLevel(occs.Count), occs);
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
            return new("disciplinary_hearing", occs.Count > 0, ToWeekLevel(occs.Count), occs);
        }

        // ─── Season-level penalty achievements ────────────────────────────────

        AchievementResultDto TheEnforcer()
        {
            var occs = penalties
                .GroupBy(p => p.SeasonId)
                .SelectMany(sg =>
                    sg.GroupBy(p => p.RosterPlayerId)
                        .Where(pg => pg.Sum(p => p.Count) >= 15)
                        .Select(pg => O(null, null, null, sg.Key, sg.First().SeasonName,
                            $"{pg.First().PlayerFirst} {pg.First().PlayerSurname}",
                            pg.Sum(p => p.Count))))
                .ToList();
            return new("the_enforcer", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
        }

        AchievementResultDto GoonSquad()
        {
            var occs = penalties
                .GroupBy(p => p.SeasonId)
                .Where(sg => sg.Sum(p => p.Count) >= 40)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(p => p.Count)))
                .ToList();
            return new("goon_squad", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
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
            return new("jailbird", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
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
            return new("unlucky", occs.Count > 0, ToMatchLevel(occs.Count), occs);
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
            return new("deep_pockets", occs.Count > 0, ToWeekLevel(occs.Count), occs);
        }

        // ─── Season-level minus point achievement ─────────────────────────────

        AchievementResultDto VipSponzor()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Negative)
                .GroupBy(p => p.SeasonId)
                .Where(sg => sg.Sum(p => p.Count) >= 36)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(p => p.Count)))
                .ToList();
            return new("vip_sponzor", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
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
            return new("the_atm", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
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
            return new("ice_general", occs.Count > 0, ToMatchLevel(occs.Count), occs);
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
            return new("good_week", occs.Count > 0, ToWeekLevel(occs.Count), occs);
        }

        // ─── Season-level plus point achievement ──────────────────────────────

        AchievementResultDto HappySeason()
        {
            var occs = points
                .Where(p => p.PointType == PointType.Positive)
                .GroupBy(p => p.SeasonId)
                .Where(sg => sg.Sum(p => p.Count) >= 25)
                .Select(sg => O(null, null, null, sg.Key, sg.First().SeasonName, null, sg.Sum(p => p.Count)))
                .ToList();
            return new("happy_season", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
        }

        // ─── Competitive season plus point achievement ────────────────────────

        AchievementResultDto KingOfTheRnk()
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
            return new("king_of_the_rnk", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
        }

        // ─── Bet achievements ─────────────────────────────────────────────────

        AchievementResultDto Oracle()
        {
            if (userCreatedBy == null) return new("oracle", false, 0, []);

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
            return new("oracle", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
        }

        AchievementResultDto TheBookie()
        {
            if (userCreatedBy == null) return new("the_bookie", false, 0, []);

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
            return new("the_bookie", occs.Count > 0, ToSeasonLevel(occs.Count), occs);
        }

        AchievementResultDto Nostradamus()
        {
            if (userCreatedBy == null) return new("nostradamus", false, 0, []);

            var occs = allBets
                .Where(b => b.CreatedBy == userCreatedBy && b.Stake >= 3)
                .Select(b =>
                {
                    var sid = b.SeasonIds.FirstOrDefault();
                    var sName = sid > 0 && seasonNames.TryGetValue(sid, out var n) ? n : null;
                    return O(null, null, null, sid > 0 ? (int?)sid : null, sName, null, (int)Math.Floor(b.Stake));
                }).ToList();
            return new("nostradamus", occs.Count > 0, ToMatchLevel(occs.Count), occs);
        }

        // ─── Combo achievement ────────────────────────────────────────────────

        AchievementResultDto SwissArmyKnife()
        {
            if (userCreatedBy == null) return new("swiss_army_knife", false, 0, []);

            var goalMatchSet    = goals.Select(g => g.MatchId).ToHashSet();
            var penaltyMatchSet = penalties.Select(p => p.MatchId).ToHashSet();
            var wonBetMatchSet  = allBets
                .Where(b => b.CreatedBy == userCreatedBy && b.Status == BetStatus.Won)
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
            return new("swiss_army_knife", occs.Count > 0, ToMatchLevel(occs.Count), occs);
        }

        // ─── Assemble result ──────────────────────────────────────────────────
        return new UserAchievementsDto(new[]
        {
            Sniper(), Domination(), Shorty(),
            GodMode(), BlueLineSnipers(),
            MassiveAttack(), OffensiveDefenseman(), PlayerLover(), GoldenStick(),
            SinBinVip(), BroadStreetBully(),
            DisciplinaryHearing(),
            TheEnforcer(), GoonSquad(), Jailbird(),
            Unlucky(), DeepPockets(), VipSponzor(), TheAtm(),
            IceGeneral(), GoodWeek(), HappySeason(), KingOfTheRnk(),
            Oracle(), TheBookie(), Nostradamus(),
            SwissArmyKnife(),
        });
    }
}
