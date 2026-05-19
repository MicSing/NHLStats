using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class BettingOddsService : IBettingOddsService
{
    private readonly NhlStatsDbContext _db;
    private const decimal AppMargin = 0.80m;
    private const decimal TeamMargin = 0.75m;
    private const decimal OccasionsMargin = 0.70m;

    public BettingOddsService(NhlStatsDbContext db) => _db = db;

    private static decimal ComputeOdds(decimal probability, decimal margin = AppMargin)
    {
        probability = Math.Clamp(probability, 0.01m, 0.99m);
        return Math.Floor(margin / probability * 100m) / 100m;
    }


    public async Task RecalculateForMatchAsync(int matchId)
    {
        var match = await _db.Matches
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var now = DateTime.UtcNow;
        var oddsToUpsert = new List<MatchOdds>();

        // ── Team Win Odds ───────────────────────────────────────────────────────
        var teamWinProbs = await ComputeTeamWinJointAsync(match);
        if (teamWinProbs is { } probs)
        {
            // 1 / 2 narrowed to regulation-time wins; 1X / 2X cover any-time wins + draw.
            var regulationShare = await ComputeSeasonRegulationShareAsync(match.SeasonId);
            decimal p1 = probs.PHosted * regulationShare;
            decimal p2 = probs.POpponent * regulationShare;
            decimal p1X = probs.PHosted + probs.PDraw;
            decimal p2X = probs.POpponent + probs.PDraw;

            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWin, TargetId = probs.HostedTeamId, Probability = p1, Odds = ComputeOdds(p1), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWin, TargetId = probs.OpponentTeamId, Probability = p2, Odds = ComputeOdds(p2, TeamMargin), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.Draw, TargetId = null, Probability = probs.PDraw, Odds = ComputeOdds(probs.PDraw, TeamMargin), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWinOrDraw, TargetId = probs.HostedTeamId, Probability = p1X, Odds = ComputeOdds(p1X, TeamMargin), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWinOrDraw, TargetId = probs.OpponentTeamId, Probability = p2X, Odds = ComputeOdds(p2X, TeamMargin), ComputedOn = now });
        }

        // ── User Goal/Penalty/PlusPoint/MinusPoint Odds ─────────────────────────
        var activeUserIds = await _db.SeasonUsers
            .Where(su => su.Season!.Matches.Any(m => m.Id == matchId))
            .Select(su => su.UserId)
            .Distinct()
            .ToListAsync();

        var completedMatchCount = await _db.Matches
            .Where(m => m.SeasonId == match.SeasonId
                        && m.CompletionType != CompletionType.None
                        && m.CompletionType != CompletionType.InProgress)
            .CountAsync();
        bool goalBettingEnabled = completedMatchCount >= 10;

        foreach (var userId in activeUserIds)
        {
            if (goalBettingEnabled)
            {
                var goalP = await ComputeUserEventProbabilityAsync(userId, matchId, UserEventKind.Goal);
                oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.UserGoal, TargetId = userId, Probability = goalP, Odds = ComputeOdds(goalP), ComputedOn = now });
            }

            var penP = await ComputeUserEventProbabilityAsync(userId, matchId, UserEventKind.Penalty);
            var plusP = await ComputeUserEventProbabilityAsync(userId, matchId, UserEventKind.PlusPoint);
            var minusP = await ComputeUserEventProbabilityAsync(userId, matchId, UserEventKind.MinusPoint);

            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.UserPenalty, TargetId = userId, Probability = penP, Odds = ComputeOdds(penP), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.UserPlusPoint, TargetId = userId, Probability = plusP, Odds = ComputeOdds(plusP), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.UserMinusPoint, TargetId = userId, Probability = minusP, Odds = ComputeOdds(minusP), ComputedOn = now });
        }

        await UpsertMatchOddsAsync(oddsToUpsert);

        if (!goalBettingEnabled)
        {
            var staleGoalOdds = await _db.MatchOdds
                .Where(o => o.MatchId == matchId && o.BetType == OddsBetType.UserGoal)
                .ToListAsync();
            if (staleGoalOdds.Count > 0)
            {
                _db.MatchOdds.RemoveRange(staleGoalOdds);
                await _db.SaveChangesAsync();
            }
        }
    }

    public async Task RecalculateAllUpcomingAsync()
    {
        var upcomingMatchIds = await _db.Matches
            .Where(m => m.CompletionType == CompletionType.None)
            .Select(m => m.Id)
            .ToListAsync();

        foreach (var matchId in upcomingMatchIds)
            await RecalculateForMatchAsync(matchId);
    }

    public async Task<OccasionsOddsDto?> GetUserEventOddsForOccasionsAsync(int matchId, OddsBetType betType, int userId, int occasions)
    {
        occasions = Math.Max(1, occasions);
        if (!TryGetUserEventKind(betType, out var kind)) return null;

        var matchExists = await _db.Matches.AnyAsync(m => m.Id == matchId);
        if (!matchExists) return null;

        if (betType == OddsBetType.UserGoal)
        {
            var targetMatch = await _db.Matches.AsNoTracking().FirstAsync(m => m.Id == matchId);
            var completedCount = await _db.Matches
                .Where(m => m.SeasonId == targetMatch.SeasonId
                            && m.CompletionType != CompletionType.None
                            && m.CompletionType != CompletionType.InProgress)
                .CountAsync();
            if (completedCount < 10) return null;
        }

        var counts = await LoadUserEventCountsAsync(userId, matchId, kind);

        static decimal OddsForN(UserEventCounts c, int n) =>
            ComputeOdds(ComputeProbabilityForOccasions(c, n), n == 1 ? AppMargin : OccasionsMargin);

        var odds = OddsForN(counts, occasions);
        int effectiveN = occasions;
        decimal effectiveOdds = odds;
        if (odds < 1m)
        {
            bool found = false;
            for (int n = occasions + 1; n <= 30; n++)
            {
                var bumped = OddsForN(counts, n);
                if (bumped >= 1m) { effectiveN = n; effectiveOdds = bumped; found = true; break; }
            }
            if (!found) return null;
        }

        if (ComputeProbabilityForOccasions(counts, effectiveN) < BettingConstants.MinBettableProbability)
            return null;

        int maxN = effectiveN;
        for (int n = effectiveN + 1; n <= 30; n++)
        {
            if (ComputeProbabilityForOccasions(counts, n) >= BettingConstants.MinBettableProbability)
                maxN = n;
            else
                break;
        }

        return new OccasionsOddsDto(effectiveN, effectiveOdds, maxN);
    }

    public async Task<MatchOddsDto?> GetMatchOddsAsync(int matchId)
    {
        var matchExists = await _db.Matches.AnyAsync(m => m.Id == matchId);
        if (!matchExists) return null;

        var matchOddsRows = await _db.MatchOdds
            .Where(o => o.MatchId == matchId)
            .ToListAsync();

        if (!matchOddsRows.Any()) return null;

        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .AsNoTracking()
            .FirstAsync(m => m.Id == matchId);

        var teamWinRows = matchOddsRows.Where(o => o.BetType == OddsBetType.TeamWin).ToList();
        TeamWinOddsDto? teamWin = null;
        if (teamWinRows.Count >= 2)
        {
            var homeRow = teamWinRows.FirstOrDefault(r => r.TargetId == match.HomeTeamId);
            var awayRow = teamWinRows.FirstOrDefault(r => r.TargetId == match.AwayTeamId);
            var drawRow = matchOddsRows.FirstOrDefault(r => r.BetType == OddsBetType.Draw);
            var home1XRow = matchOddsRows.FirstOrDefault(r => r.BetType == OddsBetType.TeamWinOrDraw && r.TargetId == match.HomeTeamId);
            var away1XRow = matchOddsRows.FirstOrDefault(r => r.BetType == OddsBetType.TeamWinOrDraw && r.TargetId == match.AwayTeamId);
            if (homeRow?.Probability < BettingConstants.MinBettableProbability) homeRow = null;
            if (awayRow?.Probability < BettingConstants.MinBettableProbability) awayRow = null;
            if (drawRow?.Probability < BettingConstants.MinBettableProbability) drawRow = null;
            if (home1XRow?.Probability < BettingConstants.MinBettableProbability) home1XRow = null;
            if (away1XRow?.Probability < BettingConstants.MinBettableProbability) away1XRow = null;
            if (homeRow != null && awayRow != null)
                teamWin = new TeamWinOddsDto(
                    match.HomeTeamId, homeRow.Odds,
                    match.AwayTeamId, awayRow.Odds,
                    drawRow?.Odds,
                    home1XRow?.Odds,
                    away1XRow?.Odds);
        }

        var userIds = matchOddsRows.Select(o => o.TargetId).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        var users = await _db.Users.Where(u => userIds.Contains(u.Id)).AsNoTracking().ToDictionaryAsync(u => u.Id, u => u.Name);

        var userGoal = await BuildUserOddsDtosAsync(matchOddsRows, OddsBetType.UserGoal, matchId, users);
        var userPenalty = await BuildUserOddsDtosAsync(matchOddsRows, OddsBetType.UserPenalty, matchId, users);
        var userPlusPoint = await BuildUserOddsDtosAsync(matchOddsRows, OddsBetType.UserPlusPoint, matchId, users);
        var userMinusPoint = await BuildUserOddsDtosAsync(matchOddsRows, OddsBetType.UserMinusPoint, matchId, users);

        var computedOn = matchOddsRows.Max(o => o.ComputedOn);
        return new MatchOddsDto(teamWin, userGoal, userPenalty, userPlusPoint, userMinusPoint, computedOn);
    }

    // ── Probability helpers ─────────────────────────────────────────────────────

    // Composite TeamWin model (hosted vs opponent, current-season scope):
    //   p_home_raw = 0.30*Pseason + 0.25*Pl10 + 0.25*Ph2h + 0.20*PgoalFactor
    //   p_away_raw = 0.30*Pseason + 0.25*Pl10 + 0.25*Ph2h + 0.20*PgoalFactor
    //   p_draw_raw = season_draws / season_games        (computed but not persisted)
    // Then normalize the three so they sum to 1; odds = AppMargin / p_final.

    // User goal/penalty model retains the legacy windowed blend:
    //   With prev season data:    P = 0.10*Pprev + 0.65*Pcurr + 0.25*Plast10
    //   Without prev season data: P = 0.75*Pcurr  + 0.25*Plast10

    private static decimal BlendUserEventProbability(decimal pprev, bool hasPrev, decimal pcurr, decimal plast10)
        => hasPrev
            ? 0.10m * pprev + 0.65m * pcurr + 0.25m * plast10
            : 0.75m * pcurr + 0.25m * plast10;

    private async Task<decimal> ComputeSeasonRegulationShareAsync(int seasonId)
    {
        var share = await RegulationShareForSeasonAsync(seasonId);
        if (share is not null) return share.Value;

        var prevSeasonId = await _db.Matches
            .Where(m => m.SeasonId < seasonId
                        && (m.CompletionType == CompletionType.RegularTime
                            || m.CompletionType == CompletionType.Overtime
                            || m.CompletionType == CompletionType.Shootout))
            .OrderByDescending(m => m.SeasonId)
            .Select(m => (int?)m.SeasonId)
            .FirstOrDefaultAsync();

        if (prevSeasonId is null) return 0.75m;
        var prevShare = await RegulationShareForSeasonAsync(prevSeasonId.Value);
        return prevShare ?? 0.75m;
    }

    private async Task<decimal?> RegulationShareForSeasonAsync(int seasonId)
    {
        var completionTypes = await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .Select(m => m.CompletionType)
            .ToListAsync();

        int regular = completionTypes.Count(c => c == CompletionType.RegularTime);
        int otherCompleted = completionTypes.Count(c => c == CompletionType.Overtime || c == CompletionType.Shootout);
        int total = regular + otherCompleted;
        if (total == 0) return null;
        return (decimal)regular / total;
    }

    private static decimal GetGoalFactor(decimal agd)
    {
        if (agd >= 3m) return 0.90m;
        if (agd >= 1m) return 0.70m;
        if (agd > -1m) return 0.50m;
        if (agd <= -3m) return 0.10m;
        return 0.30m;
    }

    private record HostedSeasonStats(
        int Games, int Wins, int Losses, int Draws,
        int L10Games, int L10Wins, int L10Losses,
        int H2hGames, int H2hWins, int H2hDraws, int H2hGoalsFor, int H2hGoalsAgainst);

    private static readonly HostedSeasonStats EmptyStats = new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

    public readonly record struct TeamWinProbabilities(int HostedTeamId, int OpponentTeamId, decimal PHosted, decimal POpponent, decimal PDraw);

    private async Task<TeamWinProbabilities?> ComputeTeamWinJointAsync(Match match)
    {
        var season = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == match.SeasonId);
        if (season?.HostedTeamId is not int hostedId) return null;
        if (hostedId != match.HomeTeamId && hostedId != match.AwayTeamId) return null;
        var opponentId = hostedId == match.HomeTeamId ? match.AwayTeamId : match.HomeTeamId;

        var stats = await LoadHostedSeasonStatsAsync(hostedId, opponentId, match.SeasonId);
        if (stats.Games == 0)
        {
            var prevSeasonId = await _db.Matches
                .Where(m => m.SeasonId < match.SeasonId
                            && (m.HomeTeamId == hostedId || m.AwayTeamId == hostedId)
                            && m.CompletionType != CompletionType.None
                            && m.CompletionType != CompletionType.InProgress)
                .OrderByDescending(m => m.SeasonId)
                .Select(m => (int?)m.SeasonId)
                .FirstOrDefaultAsync();
            if (prevSeasonId is null) return null;
            stats = await LoadHostedSeasonStatsAsync(hostedId, opponentId, prevSeasonId.Value);
            if (stats.Games == 0) return null;
        }

        decimal games = stats.Games;
        decimal pDrawRaw = stats.Draws / games;
        decimal pHomeSeason = stats.Wins / games;
        decimal pAwaySeason = stats.Losses / games;

        decimal pHomeL10, pAwayL10;
        if (stats.L10Games == 0)
        {
            pHomeL10 = pHomeSeason;
            pAwayL10 = pAwaySeason;
        }
        else
        {
            decimal l10 = stats.L10Games;
            pHomeL10 = stats.L10Wins / l10;
            pAwayL10 = stats.L10Losses / l10;
        }

        decimal pHomeH2h, pAwayH2h, pHomeGoals, pAwayGoals;
        if (stats.H2hGames == 0)
        {
            pHomeH2h = pHomeSeason;
            pAwayH2h = pAwaySeason;
            pHomeGoals = 0.50m;
            pAwayGoals = 0.50m;
        }
        else
        {
            decimal h2h = stats.H2hGames;
            pHomeH2h = stats.H2hWins / h2h;
            pAwayH2h = (stats.H2hGames - stats.H2hWins - stats.H2hDraws) / h2h;
            decimal agd = (stats.H2hGoalsFor - stats.H2hGoalsAgainst) / h2h;
            pHomeGoals = GetGoalFactor(agd);
            pAwayGoals = GetGoalFactor(-agd);
        }

        decimal pHomeRaw = 0.55m * pHomeSeason + 0.15m * pHomeL10 + 0.15m * pHomeH2h + 0.15m * pHomeGoals;
        decimal pAwayRaw = 0.55m * pAwaySeason + 0.15m * pAwayL10 + 0.15m * pAwayH2h + 0.15m * pAwayGoals;

        decimal total = pHomeRaw + pDrawRaw + pAwayRaw;
        if (total <= 0m) return null;

        return new TeamWinProbabilities(
            HostedTeamId: hostedId,
            OpponentTeamId: opponentId,
            PHosted: pHomeRaw / total,
            POpponent: pAwayRaw / total,
            PDraw: pDrawRaw / total);
    }

    private async Task<HostedSeasonStats> LoadHostedSeasonStatsAsync(int hostedId, int opponentId, int seasonId)
    {
        var matches = await _db.Matches
            .Where(m => m.SeasonId == seasonId
                        && (m.HomeTeamId == hostedId || m.AwayTeamId == hostedId)
                        && m.CompletionType != CompletionType.None
                        && m.CompletionType != CompletionType.InProgress)
            .OrderByDescending(m => m.MatchDate)
            .ToListAsync();

        if (matches.Count == 0) return EmptyStats;

        int games = 0, wins = 0, losses = 0, draws = 0;
        int h2hGames = 0, h2hWins = 0, h2hDraws = 0, h2hGoalsFor = 0, h2hGoalsAgainst = 0;

        foreach (var m in matches)
        {
            games++;
            bool isDraw = m.CompletionType != CompletionType.RegularTime || m.HomeScore == m.AwayScore;
            int hostedScore = m.HomeTeamId == hostedId ? m.HomeScore : m.AwayScore;
            int otherScore = m.HomeTeamId == hostedId ? m.AwayScore : m.HomeScore;
            int otherTeamId = m.HomeTeamId == hostedId ? m.AwayTeamId : m.HomeTeamId;

            if (isDraw) draws++;
            else if (IsWinner(m, hostedId)) wins++;
            else losses++;

            if (otherTeamId == opponentId)
            {
                h2hGames++;
                if (isDraw) h2hDraws++;
                else if (IsWinner(m, hostedId)) h2hWins++;
                h2hGoalsFor += hostedScore;
                h2hGoalsAgainst += otherScore;
            }
        }

        int l10Games = 0, l10Wins = 0, l10Losses = 0;
        foreach (var m in matches.Take(10))
        {
            l10Games++;
            if (m.HomeScore == m.AwayScore) continue;
            if (IsWinner(m, hostedId)) l10Wins++;
            else l10Losses++;
        }

        return new HostedSeasonStats(
            games, wins, losses, draws,
            l10Games, l10Wins, l10Losses,
            h2hGames, h2hWins, h2hDraws, h2hGoalsFor, h2hGoalsAgainst);
    }

    private enum UserEventKind { Goal, Penalty, PlusPoint, MinusPoint }

    private async Task<decimal> ComputeUserEventProbabilityAsync(int userId, int matchId, UserEventKind kind)
    {
        var targetMatch = await _db.Matches.AsNoTracking().FirstAsync(m => m.Id == matchId);
        var currentSeasonId = targetMatch.SeasonId;

        bool isGoal = kind == UserEventKind.Goal;

        // Plast10: last 10 completed matches — scoped to current season for goals, all-time otherwise
        var last10Query = _db.UserMatches
            .Include(um => um.Match)
            .Where(um => um.UserId == userId && um.Match!.CompletionType != CompletionType.None);
        if (isGoal)
            last10Query = last10Query.Where(um => um.SeasonId == currentSeasonId);

        var last10UserMatches = await last10Query
            .OrderByDescending(um => um.Match!.MatchDate)
            .Take(10)
            .ToListAsync();

        decimal plast10 = 0m;
        if (last10UserMatches.Count > 0)
        {
            var umIds = last10UserMatches.Select(um => um.Id).ToList();
            var withEvents = await CountUserMatchesWithEventAsync(umIds, kind);
            plast10 = (decimal)withEvents / last10UserMatches.Count;
        }

        // Pcurr: current season event rate
        var currUserMatches = await _db.UserMatches
            .Include(um => um.Match)
            .Where(um => um.UserId == userId && um.SeasonId == currentSeasonId
                         && um.Match!.CompletionType != CompletionType.None)
            .ToListAsync();

        decimal pcurr = 0m;
        if (currUserMatches.Count > 0)
        {
            var umIds = currUserMatches.Select(um => um.Id).ToList();
            var withEvents = await CountUserMatchesWithEventAsync(umIds, kind);
            pcurr = (decimal)withEvents / currUserMatches.Count;
        }

        // Pprev: previous season event rate (goals use current season only, no prev)
        decimal pprev = 0m;
        bool hasPrev = false;
        if (!isGoal)
        {
            var prevSeasonId = await _db.UserMatches
                .Where(um => um.UserId == userId && um.SeasonId < currentSeasonId)
                .OrderByDescending(um => um.SeasonId)
                .Select(um => (int?)um.SeasonId)
                .FirstOrDefaultAsync();

            if (prevSeasonId.HasValue)
            {
                var prevUserMatches = await _db.UserMatches
                    .Include(um => um.Match)
                    .Where(um => um.UserId == userId && um.SeasonId == prevSeasonId.Value
                                 && um.Match!.CompletionType != CompletionType.None)
                    .ToListAsync();
                if (prevUserMatches.Count > 0)
                {
                    var umIds = prevUserMatches.Select(um => um.Id).ToList();
                    var withEvents = await CountUserMatchesWithEventAsync(umIds, kind);
                    if (withEvents > 0)
                    {
                        pprev = (decimal)withEvents / prevUserMatches.Count;
                        hasPrev = true;
                    }
                }
            }
        }

        return BlendUserEventProbability(pprev, hasPrev, pcurr, plast10);
    }

    private Task<int> CountUserMatchesWithEventAsync(List<int> userMatchIds, UserEventKind kind) =>
        kind switch
        {
            UserEventKind.Goal => CountUserMatchesWithGoalAsync(userMatchIds),
            UserEventKind.Penalty => CountUserMatchesWithPenaltyAsync(userMatchIds),
            UserEventKind.PlusPoint => CountUserMatchesWithPointTypeAsync(userMatchIds, PointType.Positive),
            UserEventKind.MinusPoint => CountUserMatchesWithPointTypeAsync(userMatchIds, PointType.Negative),
            _ => Task.FromResult(0)
        };

    private async Task<int> CountUserMatchesWithGoalAsync(List<int> userMatchIds)
    {
        return await _db.UserMatchGoals
            .Where(g => userMatchIds.Contains(g.UserMatchId))
            .SumAsync(g => (int?)g.Count) ?? 0;
    }

    private async Task<int> CountUserMatchesWithPenaltyAsync(List<int> userMatchIds)
    {
        return await _db.UserMatchPenalties
            .Where(p => userMatchIds.Contains(p.UserMatchId))
            .SumAsync(p => (int?)p.Count) ?? 0;
    }

    private async Task<int> CountUserMatchesWithPointTypeAsync(List<int> userMatchIds, PointType pointType)
    {
        return await _db.UserMatchPoints
            .Where(p => userMatchIds.Contains(p.UserMatchId) && p.PointReason!.PointType == pointType)
            .Select(p => p.UserMatchId)
            .Distinct()
            .CountAsync();
    }

    // ── Multi-occasion helpers ──────────────────────────────────────────────────

    private async Task<List<UserOddsDto>> BuildUserOddsDtosAsync(
        List<MatchOdds> rows, OddsBetType betType, int matchId, Dictionary<int, string> users)
    {
        var result = new List<UserOddsDto>();
        if (!TryGetUserEventKind(betType, out var kind)) return result;
        foreach (var o in rows.Where(o => o.BetType == betType && o.TargetId.HasValue))
        {
            if (o.Probability < BettingConstants.MinBettableProbability) continue;
            var (n, eo, maxN) = await ResolveEffectiveOddsAsync(o.TargetId!.Value, matchId, kind, o.Odds);
            result.Add(new UserOddsDto(o.TargetId!.Value, users.GetValueOrDefault(o.TargetId!.Value), o.Odds, n, eo, maxN));
        }
        return result;
    }

    private record UserEventCounts(List<int> Last10, List<int> Curr, List<int> Prev, bool HasPrev);

    private async Task<UserEventCounts> LoadUserEventCountsAsync(int userId, int matchId, UserEventKind kind)
    {
        var targetMatch = await _db.Matches.AsNoTracking().FirstAsync(m => m.Id == matchId);
        var currentSeasonId = targetMatch.SeasonId;

        bool goalKind = kind == UserEventKind.Goal;

        var last10Query = _db.UserMatches
            .Include(um => um.Match)
            .Where(um => um.UserId == userId && um.Match!.CompletionType != CompletionType.None);
        if (goalKind)
            last10Query = last10Query.Where(um => um.SeasonId == currentSeasonId);

        var last10Ids = (await last10Query
            .OrderByDescending(um => um.Match!.MatchDate)
            .Take(10)
            .ToListAsync()).Select(um => um.Id).ToList();

        var currIds = (await _db.UserMatches
            .Include(um => um.Match)
            .Where(um => um.UserId == userId && um.SeasonId == currentSeasonId && um.Match!.CompletionType != CompletionType.None)
            .ToListAsync()).Select(um => um.Id).ToList();

        List<int> prevIds = [];
        if (!goalKind)
        {
            var prevSeasonId = await _db.UserMatches
                .Where(um => um.UserId == userId && um.SeasonId < currentSeasonId)
                .OrderByDescending(um => um.SeasonId)
                .Select(um => (int?)um.SeasonId)
                .FirstOrDefaultAsync();

            if (prevSeasonId.HasValue)
                prevIds = (await _db.UserMatches
                    .Include(um => um.Match)
                    .Where(um => um.UserId == userId && um.SeasonId == prevSeasonId.Value && um.Match!.CompletionType != CompletionType.None)
                    .ToListAsync()).Select(um => um.Id).ToList();
        }

        var last10 = await GetPerMatchCountsAsync(last10Ids, kind);
        var curr = await GetPerMatchCountsAsync(currIds, kind);
        var prev = await GetPerMatchCountsAsync(prevIds, kind);
        return new UserEventCounts(last10, curr, prev, !goalKind && prev.Any(c => c > 0));
    }

    private Task<List<int>> GetPerMatchCountsAsync(List<int> userMatchIds, UserEventKind kind) =>
        kind switch
        {
            UserEventKind.Goal => GetGoalCountsPerMatchAsync(userMatchIds),
            UserEventKind.Penalty => GetPenaltyCountsPerMatchAsync(userMatchIds),
            UserEventKind.PlusPoint => GetPointCountsPerMatchAsync(userMatchIds, PointType.Positive),
            UserEventKind.MinusPoint => GetPointCountsPerMatchAsync(userMatchIds, PointType.Negative),
            _ => Task.FromResult(new List<int>())
        };

    private async Task<List<int>> GetGoalCountsPerMatchAsync(List<int> userMatchIds)
    {
        if (userMatchIds.Count == 0) return [];
        var dict = await _db.UserMatchGoals
            .Where(g => userMatchIds.Contains(g.UserMatchId))
            .GroupBy(g => g.UserMatchId)
            .Select(g => new { Id = g.Key, Total = g.Sum(x => x.Count) })
            .ToDictionaryAsync(x => x.Id, x => x.Total);
        return userMatchIds.Select(id => dict.GetValueOrDefault(id, 0)).ToList();
    }

    private async Task<List<int>> GetPenaltyCountsPerMatchAsync(List<int> userMatchIds)
    {
        if (userMatchIds.Count == 0) return [];
        var dict = await _db.UserMatchPenalties
            .Where(p => userMatchIds.Contains(p.UserMatchId))
            .GroupBy(p => p.UserMatchId)
            .Select(g => new { Id = g.Key, Total = g.Sum(x => x.Count) })
            .ToDictionaryAsync(x => x.Id, x => x.Total);
        return userMatchIds.Select(id => dict.GetValueOrDefault(id, 0)).ToList();
    }

    private async Task<List<int>> GetPointCountsPerMatchAsync(List<int> userMatchIds, PointType pointType)
    {
        if (userMatchIds.Count == 0) return [];
        var dict = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => userMatchIds.Contains(p.UserMatchId) && p.PointReason!.PointType == pointType)
            .GroupBy(p => p.UserMatchId)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);
        return userMatchIds.Select(id => dict.GetValueOrDefault(id, 0)).ToList();
    }

    private static decimal ComputeProbabilityForOccasions(UserEventCounts data, int occasions)
    {
        static decimal Rate(List<int> counts, int n) => counts.Count == 0 ? 0m
            : n == 1 ? (decimal)counts.Sum() / counts.Count
            : (decimal)counts.Count(c => c >= n) / counts.Count;

        var plast10 = Rate(data.Last10, occasions);
        var pcurr = Rate(data.Curr, occasions);
        var pprev = Rate(data.Prev, occasions);
        return BlendUserEventProbability(pprev, data.HasPrev && pprev > 0, pcurr, plast10);
    }

    private async Task<(int MinOccasions, decimal EffectiveOdds, int MaxOccasions)> ResolveEffectiveOddsAsync(
        int userId, int matchId, UserEventKind kind, decimal baseOdds)
    {
        var counts = await LoadUserEventCountsAsync(userId, matchId, kind);

        int minN = 1;
        decimal effectiveOdds = baseOdds;
        for (int n = 1; n <= 30; n++)
        {
            var margin = n == 1 ? AppMargin : OccasionsMargin;
            var o = ComputeOdds(ComputeProbabilityForOccasions(counts, n), margin);
            if (o >= 1m) { minN = n; effectiveOdds = o; break; }
        }

        int maxN = minN;
        for (int n = minN; n <= 30; n++)
        {
            if (ComputeProbabilityForOccasions(counts, n) >= BettingConstants.MinBettableProbability)
                maxN = n;
            else
                break;
        }

        return (minN, effectiveOdds, maxN);
    }

    private static bool TryGetUserEventKind(OddsBetType betType, out UserEventKind kind)
    {
        kind = betType switch
        {
            OddsBetType.UserGoal => UserEventKind.Goal,
            OddsBetType.UserPenalty => UserEventKind.Penalty,
            OddsBetType.UserPlusPoint => UserEventKind.PlusPoint,
            OddsBetType.UserMinusPoint => UserEventKind.MinusPoint,
            _ => default
        };
        return betType is OddsBetType.UserGoal or OddsBetType.UserPenalty
                       or OddsBetType.UserPlusPoint or OddsBetType.UserMinusPoint;
    }

    private static bool IsWinner(Match match, int teamId)
    {
        if (match.HomeScore == match.AwayScore) return false;
        return match.HomeTeamId == teamId
            ? match.HomeScore > match.AwayScore
            : match.AwayScore > match.HomeScore;
    }

    private async Task UpsertMatchOddsAsync(List<MatchOdds> newOdds)
    {
        foreach (var odds in newOdds)
        {
            var existing = await _db.MatchOdds
                .FirstOrDefaultAsync(o => o.MatchId == odds.MatchId
                                          && o.BetType == odds.BetType
                                          && o.TargetId == odds.TargetId);
            if (existing == null)
                _db.MatchOdds.Add(odds);
            else
            {
                existing.Probability = odds.Probability;
                existing.Odds = odds.Odds;
                existing.ComputedOn = odds.ComputedOn;
            }
        }

        await _db.SaveChangesAsync();
    }
}
