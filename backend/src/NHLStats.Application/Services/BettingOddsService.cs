using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class BettingOddsService : IBettingOddsService
{
    private readonly NhlStatsDbContext _db;
    private readonly ISeasonEventBroadcaster? _broadcaster;

    public BettingOddsService(NhlStatsDbContext db, ISeasonEventBroadcaster? broadcaster = null)
    {
        _db = db;
        _broadcaster = broadcaster;
    }

    // Margin is applied to the profit above stake return, not to the whole payout:
    // fairOdds = 1/probability; offeredOdds = 1 + (fairOdds - 1) * margin.
    // This keeps offeredOdds >= 1 for any probability in (0, 1) — a margin < 1 shaves the
    // bettor's edge rather than collapsing the whole market below 1.0 for likely outcomes.
    // BettingConstants.MinBettableOdds is the separate floor for "worth offering at all".
    // Delegates to OddsFormula so this stays the one place the current (2.2) formula is defined —
    // see OddsFormula for the versioned formula used to reprice historical tickets. The margin is
    // per match (OddsFormula.MatchMargin), so identical matchups don't get identical odds.
    private static decimal ComputeOdds(int matchId, decimal probability) =>
        OddsFormula.Compute(OddsFormulaTier.Current, probability, OddsFormula.MatchMargin(matchId));


    public Task RecalculateForMatchAsync(int matchId) =>
        RecalculateForMatchAsync(matchId, new UserHistoryCache(_db));

    // `history` is shared by every match of one recalculation batch, so per-player history is
    // read once per batch instead of once per player × market × match.
    private async Task RecalculateForMatchAsync(int matchId, UserHistoryCache history)
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

            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWin, TargetId = probs.HostedTeamId, Probability = p1, Odds = ComputeOdds(matchId, p1), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWin, TargetId = probs.OpponentTeamId, Probability = p2, Odds = ComputeOdds(matchId, p2), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.Draw, TargetId = null, Probability = probs.PDraw, Odds = ComputeOdds(matchId, probs.PDraw), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWinOrDraw, TargetId = probs.HostedTeamId, Probability = p1X, Odds = ComputeOdds(matchId, p1X), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWinOrDraw, TargetId = probs.OpponentTeamId, Probability = p2X, Odds = ComputeOdds(matchId, p2X), ComputedOn = now });
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

        // ── Match Total Goals Odds ──────────────────────────────────────────────
        if (goalBettingEnabled)
        {
            var goalsBuckets = await LoadLeagueGoalsBucketsAsync(match);
            foreach (var n in PickGoalWindow(matchId, goalsBuckets))
            {
                var p = BlendTotalGoalsProbability(goalsBuckets, n);
                oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.MatchTotalGoals, TargetId = n, Probability = p, Odds = ComputeOdds(matchId, p), ComputedOn = now });
            }
        }

        // ── Shutout Win Odds ────────────────────────────────────────────────────
        // Only the hosted team has a full tracked season of matches in this system — "opponent"
        // teams only appear in the handful of games they've played against the hosted team, so
        // there's no reliable independent history to draw an opponent-side season/last10/home-away
        // rate from. Both markets are therefore computed entirely from the hosted team's own record:
        // HostedShutoutWin = hosted team's shutout-WIN rate, OpponentShutoutWin = hosted team's
        // shutout-LOSS rate (scored 0, lost) — same buckets, opposite outcome being measured.
        if (teamWinProbs is { } shutoutTeams)
        {
            var hostedBuckets = await LoadTeamShutoutBucketsAsync(match, shutoutTeams.HostedTeamId, shutoutTeams.OpponentTeamId);
            var pHostedShutout = BlendShutoutProbability(hostedBuckets, TeamWonWithShutout);
            var pOpponentShutout = BlendShutoutProbability(hostedBuckets, TeamShutOut);
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.HostedShutoutWin, TargetId = null, Probability = pHostedShutout, Odds = ComputeOdds(matchId, pHostedShutout), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.OpponentShutoutWin, TargetId = null, Probability = pOpponentShutout, Odds = ComputeOdds(matchId, pOpponentShutout), ComputedOn = now });
        }

        await history.EnsureLoadedAsync(activeUserIds);
        foreach (var userId in activeUserIds)
        {
            if (goalBettingEnabled)
                oddsToUpsert.Add(await BuildUserOddsRowAsync(match, userId, OddsBetType.UserGoal, UserEventKind.Goal, now, history));

            oddsToUpsert.Add(await BuildUserOddsRowAsync(match, userId, OddsBetType.UserPenalty, UserEventKind.Penalty, now, history));
            oddsToUpsert.Add(await BuildUserOddsRowAsync(match, userId, OddsBetType.UserPlusPoint, UserEventKind.PlusPoint, now, history));
            oddsToUpsert.Add(await BuildUserOddsRowAsync(match, userId, OddsBetType.UserMinusPoint, UserEventKind.MinusPoint, now, history));
        }

        await UpsertMatchOddsAsync(matchId, oddsToUpsert);

        if (!goalBettingEnabled)
        {
            var staleGoalOdds = await _db.MatchOdds
                .Where(o => o.MatchId == matchId && (o.BetType == OddsBetType.UserGoal || o.BetType == OddsBetType.MatchTotalGoals))
                .ToListAsync();
            if (staleGoalOdds.Count > 0)
            {
                _db.MatchOdds.RemoveRange(staleGoalOdds);
                await _db.SaveChangesAsync();
            }
        }
        else
        {
            // The 4-N goal window can shift between recalcs; drop rows for thresholds no longer in the window.
            var keptThresholds = oddsToUpsert
                .Where(o => o.BetType == OddsBetType.MatchTotalGoals)
                .Select(o => o.TargetId)
                .ToHashSet();
            var staleThresholdOdds = await _db.MatchOdds
                .Where(o => o.MatchId == matchId && o.BetType == OddsBetType.MatchTotalGoals)
                .ToListAsync();
            var toRemove = staleThresholdOdds.Where(o => !keptThresholds.Contains(o.TargetId)).ToList();
            if (toRemove.Count > 0)
            {
                _db.MatchOdds.RemoveRange(toRemove);
                await _db.SaveChangesAsync();
            }
        }

        await TryBroadcastOddsUpdatedAsync(match);
    }

    // Tells clients viewing the season that this match's stored odds changed, so they can
    // refetch just this match instead of polling or recalculating on their side.
    private async Task TryBroadcastOddsUpdatedAsync(Match match)
    {
        if (_broadcaster == null) return;
        try
        {
            await _broadcaster.BroadcastEventAsync(new SeasonEventNotificationDto(
                SeasonId: match.SeasonId,
                MatchId: match.Id,
                UserMatchId: 0,
                ActorUserId: null,
                ActorUserName: null,
                EventType: "OddsUpdated",
                EventSubType: string.Empty,
                PlayerName: null,
                Count: 0));
        }
        catch
        {
            // best-effort: broadcast failures must never affect the stored odds
        }
    }

    private async Task<MatchOdds> BuildUserOddsRowAsync(
        Match match, int userId, OddsBetType betType, UserEventKind kind, DateTime now, UserHistoryCache history)
    {
        var counts = await history.GetCountsAsync(userId, match.SeasonId, kind);
        var probability = ComputeUserEventProbability(counts, kind);
        var odds = ComputeOdds(match.Id, probability);
        var (minN, effectiveOdds, maxN) = ResolveEffectiveOdds(match.Id, counts, odds);
        return new MatchOdds
        {
            MatchId = match.Id, BetType = betType, TargetId = userId,
            Probability = probability, Odds = odds, ComputedOn = now,
            MinOccasions = minN, EffectiveOdds = effectiveOdds, MaxOccasions = maxN,
        };
    }

    public async Task<int> RecalculateAllUpcomingAsync()
    {
        var upcomingMatchIds = await _db.Matches
            .Where(m => m.CompletionType == CompletionType.None)
            .Select(m => m.Id)
            .ToListAsync();

        var history = new UserHistoryCache(_db);
        foreach (var matchId in upcomingMatchIds)
            await RecalculateForMatchAsync(matchId, history);

        return upcomingMatchIds.Count;
    }

    public async Task RecalculateUpcomingAsync(int count = 7)
    {
        var normalizedCount = count <= 0 ? 7 : count;
        var now = DateTime.UtcNow;

        var upcomingMatchIds = await _db.Matches
            .Where(m => m.CompletionType == CompletionType.None)
            .Where(m => !m.MatchDate.HasValue || m.MatchDate.Value > now)
            .OrderBy(m => m.MatchDate == null)
            .ThenBy(m => m.MatchDate)
            .ThenByDescending(m => m.Season!.StartedOn)
            .ThenBy(m => m.MatchNumber)
            .Take(normalizedCount)
            .Select(m => m.Id)
            .ToListAsync();

        var history = new UserHistoryCache(_db);
        foreach (var matchId in upcomingMatchIds)
            await RecalculateForMatchAsync(matchId, history);
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

        var targetSeasonId = await _db.Matches.Where(m => m.Id == matchId).Select(m => m.SeasonId).FirstAsync();
        var history = new UserHistoryCache(_db);
        await history.EnsureLoadedAsync([userId]);
        var counts = await history.GetCountsAsync(userId, targetSeasonId, kind);

        decimal OddsForN(UserEventCounts c, int n) =>
            ComputeOdds(matchId, ComputeProbabilityForOccasions(c, n));

        var odds = OddsForN(counts, occasions);
        int effectiveN = occasions;
        decimal effectiveOdds = odds;
        if (odds < BettingConstants.MinBettableOdds)
        {
            bool found = false;
            for (int n = occasions + 1; n <= 30; n++)
            {
                var bumped = OddsForN(counts, n);
                if (bumped >= BettingConstants.MinBettableOdds) { effectiveN = n; effectiveOdds = bumped; found = true; break; }
            }
            if (!found) return null;
        }

        var effectiveProbability = ComputeProbabilityForOccasions(counts, effectiveN);
        if (effectiveProbability < BettingConstants.MinBettableProbability)
            return null;

        int maxN = effectiveN;
        for (int n = effectiveN + 1; n <= 30; n++)
        {
            if (ComputeProbabilityForOccasions(counts, n) >= BettingConstants.MinBettableProbability)
                maxN = n;
            else
                break;
        }

        return new OccasionsOddsDto(effectiveN, effectiveOdds, maxN, effectiveProbability);
    }

    public async Task<MatchOddsDto?> GetMatchOddsAsync(int matchId)
    {
        var matchExists = await _db.Matches.AnyAsync(m => m.Id == matchId);
        if (!matchExists) return null;

        var matchOddsRows = await _db.MatchOdds
            .Where(o => o.MatchId == matchId)
            .ToListAsync();

        // Odds are normally precomputed when a match ends; only calculate here when this match
        // has never been calculated, or its user rows predate the stored effective-odds columns.
        if (!matchOddsRows.Any() || matchOddsRows.Any(o => IsUserEventBetType(o.BetType) && o.EffectiveOdds == null))
        {
            await RecalculateForMatchAsync(matchId);
            matchOddsRows = await _db.MatchOdds
                .Where(o => o.MatchId == matchId)
                .ToListAsync();
        }

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
            if (homeRow?.Odds < BettingConstants.MinBettableOdds) homeRow = null;
            if (awayRow?.Odds < BettingConstants.MinBettableOdds) awayRow = null;
            if (drawRow?.Odds < BettingConstants.MinBettableOdds) drawRow = null;
            if (home1XRow?.Odds < BettingConstants.MinBettableOdds) home1XRow = null;
            if (away1XRow?.Odds < BettingConstants.MinBettableOdds) away1XRow = null;
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

        var userGoal = BuildUserOddsDtos(matchOddsRows, OddsBetType.UserGoal, users);
        var userPenalty = BuildUserOddsDtos(matchOddsRows, OddsBetType.UserPenalty, users);
        var userPlusPoint = BuildUserOddsDtos(matchOddsRows, OddsBetType.UserPlusPoint, users);
        var userMinusPoint = BuildUserOddsDtos(matchOddsRows, OddsBetType.UserMinusPoint, users);

        var matchTotalGoals = matchOddsRows
            .Where(o => o.BetType == OddsBetType.MatchTotalGoals && o.TargetId.HasValue && o.Odds >= BettingConstants.MinBettableOdds)
            .OrderBy(o => o.TargetId)
            .Select(o => new MatchTotalGoalsOddsDto(o.TargetId!.Value, o.Odds))
            .ToList();

        var hostedShutoutRow = matchOddsRows.FirstOrDefault(o => o.BetType == OddsBetType.HostedShutoutWin);
        var opponentShutoutRow = matchOddsRows.FirstOrDefault(o => o.BetType == OddsBetType.OpponentShutoutWin);
        decimal? hostedShutoutOdds = hostedShutoutRow != null
            && hostedShutoutRow.Probability >= BettingConstants.MinBettableProbability
            && hostedShutoutRow.Odds >= BettingConstants.MinBettableOdds
            ? hostedShutoutRow.Odds : null;
        decimal? opponentShutoutOdds = opponentShutoutRow != null
            && opponentShutoutRow.Probability >= BettingConstants.MinBettableProbability
            && opponentShutoutRow.Odds >= BettingConstants.MinBettableOdds
            ? opponentShutoutRow.Odds : null;

        var computedOn = matchOddsRows.Max(o => o.ComputedOn);
        return new MatchOddsDto(teamWin, userGoal, userPenalty, userPlusPoint, userMinusPoint,
            matchTotalGoals, hostedShutoutOdds, opponentShutoutOdds, computedOn);
    }

    // ── Probability helpers ─────────────────────────────────────────────────────

    // Composite TeamWin model (hosted vs opponent, current-season scope):
    //   p_home_raw = 0.30*Pseason + 0.25*Pl10 + 0.25*Ph2h + 0.20*PgoalFactor
    //   p_away_raw = 0.30*Pseason + 0.25*Pl10 + 0.25*Ph2h + 0.20*PgoalFactor
    //   p_draw_raw = season_draws / season_games        (computed but not persisted)
    // Then normalize the three so they sum to 1; odds are then priced from p_final via ComputeOdds.

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

    // ── Match Total Goals / Shutout Win shared bucket loading ──────────────────
    // Odds Bucket weights (see CONTEXT.md): 65% season (league-wide), 15% last10 (league-wide),
    // 10% head-to-head (these two teams, any season), 10% home/away (league-wide, side-matched).

    private record LeagueGoalsBuckets(
        List<Match> Season, List<Match> Last10, List<Match> H2h, List<Match> HomeAwaySide);

    private async Task<LeagueGoalsBuckets> LoadLeagueGoalsBucketsAsync(Match match)
    {
        var seasonMatches = await _db.Matches
            .AsNoTracking()
            .Where(m => m.SeasonId == match.SeasonId
                        && m.CompletionType != CompletionType.None
                        && m.CompletionType != CompletionType.InProgress)
            .OrderByDescending(m => m.MatchDate)
            .ToListAsync();

        var last10 = seasonMatches.Take(10).ToList();

        var h2h = await LoadHeadToHeadMatchesAsync(match.HomeTeamId, match.AwayTeamId, match.SeasonId);

        // Bucket 4: this match's home team's own home-match history this season (total-goals rate when THEY play at home).
        var homeTeamAtHome = seasonMatches.Where(m => m.HomeTeamId == match.HomeTeamId).ToList();

        return new LeagueGoalsBuckets(seasonMatches, last10, h2h, homeTeamAtHome);
    }

    private async Task<List<Match>> LoadHeadToHeadMatchesAsync(int homeTeamId, int awayTeamId, int excludeAboveSeasonId)
    {
        return await _db.Matches
            .AsNoTracking()
            .Where(m => m.SeasonId <= excludeAboveSeasonId
                        && m.CompletionType != CompletionType.None
                        && m.CompletionType != CompletionType.InProgress
                        && ((m.HomeTeamId == homeTeamId && m.AwayTeamId == awayTeamId)
                            || (m.HomeTeamId == awayTeamId && m.AwayTeamId == homeTeamId)))
            .ToListAsync();
    }

    private static bool TotalGoalsAtLeast(Match m, int n) => m.HomeScore + m.AwayScore >= n;

    private static decimal Rate(List<Match> matches, Func<Match, bool> predicate) =>
        matches.Count == 0 ? 0m : (decimal)matches.Count(predicate) / matches.Count;

    private static decimal BlendTotalGoalsProbability(LeagueGoalsBuckets b, int n)
    {
        decimal pSeason = Rate(b.Season, m => TotalGoalsAtLeast(m, n));
        decimal pLast10 = b.Last10.Count == 0 ? pSeason : Rate(b.Last10, m => TotalGoalsAtLeast(m, n));
        decimal pH2h = b.H2h.Count == 0 ? pSeason : Rate(b.H2h, m => TotalGoalsAtLeast(m, n));
        decimal pHomeAway = b.HomeAwaySide.Count == 0 ? pSeason : Rate(b.HomeAwaySide, m => TotalGoalsAtLeast(m, n));
        return 0.65m * pSeason + 0.15m * pLast10 + 0.10m * pH2h + 0.10m * pHomeAway;
    }

    private static IEnumerable<int> PickGoalWindow(int matchId, LeagueGoalsBuckets b)
    {
        // Slide a 4-wide window of N-thresholds up until its bottom edge is bettable (odds >= 1.0).
        // Floor is fixed at BettingConstants.MinGoalThreshold — the window never drops below 3+.
        for (int start = BettingConstants.MinGoalThreshold; start <= BettingConstants.MinGoalThreshold + 30; start++)
        {
            var window = Enumerable.Range(start, BettingConstants.GoalWindowSize).ToList();
            var bottomOdds = ComputeOdds(matchId, BlendTotalGoalsProbability(b, window[0]));
            if (bottomOdds < BettingConstants.MinBettableOdds) continue;

            var topProb = BlendTotalGoalsProbability(b, window[^1]);
            if (topProb < BettingConstants.MinBettableProbability)
            {
                // Top of window is unbettable — trim the window down to only the bettable thresholds.
                return window.Where(n => BlendTotalGoalsProbability(b, n) >= BettingConstants.MinBettableProbability);
            }

            return window;
        }
        return [];
    }

    private record ShutoutBuckets(
        List<Match> Season, List<Match> Last10, List<Match> H2h, List<Match> SameSide, int TeamId);

    // Loads the buckets for "teamId wins by shutout" (any-time win, opponentTeamId held to 0),
    // all scoped to teamId's own match history — see CONTEXT.md Odds Bucket entry.
    private async Task<ShutoutBuckets> LoadTeamShutoutBucketsAsync(Match match, int teamId, int opponentTeamId)
    {
        var seasonMatches = await _db.Matches
            .AsNoTracking()
            .Where(m => m.SeasonId == match.SeasonId
                        && (m.HomeTeamId == teamId || m.AwayTeamId == teamId)
                        && m.CompletionType != CompletionType.None
                        && m.CompletionType != CompletionType.InProgress)
            .OrderByDescending(m => m.MatchDate)
            .ToListAsync();

        var last10 = seasonMatches.Take(10).ToList();
        var h2h = await LoadHeadToHeadMatchesAsync(teamId, opponentTeamId, match.SeasonId);

        bool teamIsHome = teamId == match.HomeTeamId;
        var sameSide = seasonMatches.Where(m => (m.HomeTeamId == teamId) == teamIsHome).ToList();

        return new ShutoutBuckets(seasonMatches, last10, h2h, sameSide, teamId);
    }

    // teamId wins by shutout: teamId scores more, opponent scores 0.
    private static bool TeamWonWithShutout(Match m, int teamId) =>
        m.HomeTeamId == teamId
            ? (m.HomeScore > m.AwayScore && m.AwayScore == 0)
            : (m.AwayScore > m.HomeScore && m.HomeScore == 0);

    // teamId is shut out and loses: opponent scores more, teamId scores 0.
    private static bool TeamShutOut(Match m, int teamId) =>
        m.HomeTeamId == teamId
            ? (m.AwayScore > m.HomeScore && m.HomeScore == 0)
            : (m.HomeScore > m.AwayScore && m.AwayScore == 0);

    private static decimal BlendShutoutProbability(ShutoutBuckets b, Func<Match, int, bool> predicate)
    {
        Func<Match, bool> matches = m => predicate(m, b.TeamId);
        decimal pSeason = Rate(b.Season, matches);
        decimal pLast10 = b.Last10.Count == 0 ? pSeason : Rate(b.Last10, matches);
        decimal pH2h = b.H2h.Count == 0 ? pSeason : Rate(b.H2h, matches);
        decimal pSameSide = b.SameSide.Count == 0 ? pSeason : Rate(b.SameSide, matches);

        return 0.65m * pSeason + 0.15m * pLast10 + 0.10m * pH2h + 0.10m * pSameSide;
    }

    private enum UserEventKind { Goal, Penalty, PlusPoint, MinusPoint }

    // Same measure the odds have always used: total events per match for goals and penalties,
    // matches with at least one point for plus/minus points.
    private static decimal EventRate(List<int> perMatchCounts, UserEventKind kind)
    {
        if (perMatchCounts.Count == 0) return 0m;
        var withEvents = kind is UserEventKind.PlusPoint or UserEventKind.MinusPoint
            ? perMatchCounts.Count(c => c > 0)
            : perMatchCounts.Sum();
        return (decimal)withEvents / perMatchCounts.Count;
    }

    private static decimal ComputeUserEventProbability(UserEventCounts counts, UserEventKind kind)
    {
        var plast10 = EventRate(counts.Last10, kind);
        var pcurr = EventRate(counts.Curr, kind);
        // Pprev: previous season event rate (goals use the current season only)
        var pprev = EventRate(counts.Prev, kind);
        return BlendUserEventProbability(pprev, pprev > 0, pcurr, plast10);
    }

    // ── Multi-occasion helpers ──────────────────────────────────────────────────

    private static List<UserOddsDto> BuildUserOddsDtos(
        List<MatchOdds> rows, OddsBetType betType, Dictionary<int, string> users)
    {
        var result = new List<UserOddsDto>();
        foreach (var o in rows.Where(o => o.BetType == betType && o.TargetId.HasValue))
        {
            if (o.Probability < BettingConstants.MinBettableProbability) continue;
            // Don't reject on the raw occasions=1 odds alone — the stored effective odds already
            // tried higher occasions thresholds (2+, 3+, ...) up to 30 during recalculation, so a
            // user whose "at least once" price is too short (odds < MinBettableOdds) still gets a
            // shot at a bettable "N+" market instead of just disappearing from the list.
            var eo = o.EffectiveOdds ?? o.Odds;
            if (eo < BettingConstants.MinBettableOdds) continue; // no occasions threshold clears the floor even after bumping
            var n = o.MinOccasions ?? 1;
            result.Add(new UserOddsDto(o.TargetId!.Value, users.GetValueOrDefault(o.TargetId!.Value), o.Odds, n, eo, o.MaxOccasions ?? n));
        }
        return result;
    }

    private record UserEventCounts(List<int> Last10, List<int> Curr, List<int> Prev, bool HasPrev);

    private static OddsBetType UserEventKindToBetType(UserEventKind kind) => kind switch
    {
        UserEventKind.Goal => OddsBetType.UserGoal,
        UserEventKind.Penalty => OddsBetType.UserPenalty,
        UserEventKind.PlusPoint => OddsBetType.UserPlusPoint,
        _ => OddsBetType.UserMinusPoint,
    };

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

    private static (int MinOccasions, decimal EffectiveOdds, int MaxOccasions) ResolveEffectiveOdds(
        int matchId, UserEventCounts counts, decimal baseOdds)
    {
        int minN = 1;
        decimal effectiveOdds = baseOdds;
        for (int n = 1; n <= 30; n++)
        {
            var o = ComputeOdds(matchId, ComputeProbabilityForOccasions(counts, n));
            if (o >= BettingConstants.MinBettableOdds) { minN = n; effectiveOdds = o; break; }
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

    private static bool IsUserEventBetType(OddsBetType betType) => TryGetUserEventKind(betType, out _);

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

    private async Task UpsertMatchOddsAsync(int matchId, List<MatchOdds> newOdds)
    {
        var distinctOdds = newOdds
            .GroupBy(o => (o.MatchId, o.BetType, o.TargetId))
            .Select(g => g.Last())
            .ToList();

        // Odds recalculation can run concurrently for the same match — e.g. placing a bet
        // recalculates one match in the foreground while the background "recalculate
        // upcoming odds" pass (fired from MatchService) touches it too. Each path uses its
        // own DbContext, so a plain read-then-write upsert can lose that race: both see no
        // existing row for a (MatchType, BetType, TargetId) triple and both try to INSERT,
        // and the loser hits the unique index. Retry against the latest state rather than
        // letting that surface as a hard failure.
        const int maxAttempts = 3;
        for (var attempt = 1; ; attempt++)
        {
            var existingOdds = await _db.MatchOdds
                .Where(o => o.MatchId == matchId)
                .ToListAsync();

            var trackedOdds = _db.MatchOdds.Local.Where(o => o.MatchId == matchId).ToList();
            var allKnownOdds = existingOdds.Union(trackedOdds).ToList();

            var added = new List<MatchOdds>();
            foreach (var odds in distinctOdds)
            {
                var existing = allKnownOdds.FirstOrDefault(o =>
                    o.BetType == odds.BetType && o.TargetId == odds.TargetId);
                if (existing == null)
                {
                    _db.MatchOdds.Add(odds);
                    allKnownOdds.Add(odds);
                    added.Add(odds);
                }
                else
                {
                    existing.Probability = odds.Probability;
                    existing.Odds = odds.Odds;
                    existing.ComputedOn = odds.ComputedOn;
                    existing.MinOccasions = odds.MinOccasions;
                    existing.EffectiveOdds = odds.EffectiveOdds;
                    existing.MaxOccasions = odds.MaxOccasions;
                }
            }

            try
            {
                await _db.SaveChangesAsync();
                return;
            }
            catch (DbUpdateException) when (attempt < maxAttempts)
            {
                // A concurrent writer beat us to it. Undo our pending additions so the
                // next attempt re-reads the now-current rows and updates them instead.
                foreach (var odds in added)
                    _db.Entry(odds).State = EntityState.Detached;
            }
        }
    }

    /// <summary>
    /// Every active player's completed-match history with per-match event counts, read in a few
    /// bulk queries and then sliced in memory (last 10, current season, previous season) for each
    /// match × market. Shared by all matches of one recalculation batch.
    /// </summary>
    private sealed class UserHistoryCache(NhlStatsDbContext db)
    {
        private sealed record PlayedMatch(int UserMatchId, int SeasonId, DateTime? MatchDate);

        private sealed class UserHistory
        {
            // Newest first — the order "last 10" is taken in.
            public List<PlayedMatch> Completed { get; init; } = [];
            public List<int> SeasonIds { get; init; } = [];
        }

        private readonly Dictionary<int, UserHistory> _users = [];
        private readonly Dictionary<int, int> _goals = [];
        private readonly Dictionary<int, int> _penalties = [];
        private readonly Dictionary<int, int> _plusPoints = [];
        private readonly Dictionary<int, int> _minusPoints = [];
        // Previous-season per-match counts, from the UserSeasonEventDistribution cache table.
        private readonly Dictionary<(int UserId, int SeasonId, OddsBetType BetType), List<int>> _seasonCounts = [];

        public async Task EnsureLoadedAsync(IReadOnlyCollection<int> userIds)
        {
            var missing = userIds.Where(id => !_users.ContainsKey(id)).Distinct().ToList();
            if (missing.Count == 0) return;

            var completed = await db.UserMatches
                .AsNoTracking()
                .Where(um => missing.Contains(um.UserId) && um.Match!.CompletionType != CompletionType.None)
                .Select(um => new { um.Id, um.UserId, um.SeasonId, MatchDate = um.Match!.MatchDate })
                .ToListAsync();

            var seasons = await db.UserMatches
                .AsNoTracking()
                .Where(um => missing.Contains(um.UserId))
                .Select(um => new { um.UserId, um.SeasonId })
                .Distinct()
                .ToListAsync();

            var goals = await db.UserMatchGoals
                .AsNoTracking()
                .Where(g => missing.Contains(g.UserMatch!.UserId) && g.GoalType != GoalType.Shootout)
                .GroupBy(g => g.UserMatchId)
                .Select(g => new { Id = g.Key, Total = g.Sum(x => x.Count) })
                .ToListAsync();

            var penalties = await db.UserMatchPenalties
                .AsNoTracking()
                .Where(p => missing.Contains(p.UserMatch!.UserId))
                .GroupBy(p => p.UserMatchId)
                .Select(g => new { Id = g.Key, Total = g.Sum(x => x.Count) })
                .ToListAsync();

            var points = await db.UserMatchPoints
                .AsNoTracking()
                .Where(p => missing.Contains(p.UserMatch!.UserId))
                .GroupBy(p => new { p.UserMatchId, p.PointReason!.PointType })
                .Select(g => new { g.Key.UserMatchId, g.Key.PointType, Rows = g.Count() })
                .ToListAsync();

            var distributions = await db.UserSeasonEventDistributions
                .AsNoTracking()
                .Where(d => missing.Contains(d.UserId))
                .ToListAsync();

            foreach (var userId in missing)
            {
                _users[userId] = new UserHistory
                {
                    // Nulls last on a descending date, like SQL Server; ties broken by id for a stable pick.
                    Completed = completed
                        .Where(c => c.UserId == userId)
                        .OrderByDescending(c => c.MatchDate)
                        .ThenBy(c => c.Id)
                        .Select(c => new PlayedMatch(c.Id, c.SeasonId, c.MatchDate))
                        .ToList(),
                    SeasonIds = seasons.Where(x => x.UserId == userId).Select(x => x.SeasonId).ToList(),
                };
            }
            foreach (var g in goals) _goals[g.Id] = g.Total;
            foreach (var p in penalties) _penalties[p.Id] = p.Total;
            foreach (var p in points)
            {
                if (p.PointType == PointType.Positive) _plusPoints[p.UserMatchId] = p.Rows;
                else if (p.PointType == PointType.Negative) _minusPoints[p.UserMatchId] = p.Rows;
            }
            foreach (var group in distributions.GroupBy(d => (d.UserId, d.SeasonId, d.BetType)))
                _seasonCounts[group.Key] = group.SelectMany(d => Enumerable.Repeat(d.Occurrences, d.MatchCount)).ToList();
        }

        public async Task<UserEventCounts> GetCountsAsync(int userId, int currentSeasonId, UserEventKind kind)
        {
            var user = _users[userId];
            bool isGoal = kind == UserEventKind.Goal;

            // Last 10 completed matches — current season only for goals, all-time otherwise.
            var last10 = user.Completed
                .Where(m => !isGoal || m.SeasonId == currentSeasonId)
                .Take(10)
                .Select(m => CountFor(m.UserMatchId, kind))
                .ToList();
            var curr = user.Completed
                .Where(m => m.SeasonId == currentSeasonId)
                .Select(m => CountFor(m.UserMatchId, kind))
                .ToList();

            List<int> prev = [];
            if (!isGoal)
            {
                var prevSeasonId = user.SeasonIds.Where(id => id < currentSeasonId).Select(id => (int?)id).Max();
                if (prevSeasonId.HasValue)
                    prev = await GetSeasonCountsAsync(userId, prevSeasonId.Value, kind);
            }

            return new UserEventCounts(last10, curr, prev, !isGoal && prev.Any(c => c > 0));
        }

        private int CountFor(int userMatchId, UserEventKind kind) => kind switch
        {
            UserEventKind.Goal => _goals.GetValueOrDefault(userMatchId),
            UserEventKind.Penalty => _penalties.GetValueOrDefault(userMatchId),
            UserEventKind.PlusPoint => _plusPoints.GetValueOrDefault(userMatchId),
            UserEventKind.MinusPoint => _minusPoints.GetValueOrDefault(userMatchId),
            _ => 0,
        };

        // Per-match event counts for one user in one (previous) season, served from the cached
        // UserSeasonEventDistribution rows. Only built from match data the first time, or after
        // NhlStatsDbContext dropped the cache because that season's stats changed.
        private async Task<List<int>> GetSeasonCountsAsync(int userId, int seasonId, UserEventKind kind)
        {
            var betType = UserEventKindToBetType(kind);
            if (_seasonCounts.TryGetValue((userId, seasonId, betType), out var cached))
                return cached;

            var counts = _users[userId].Completed
                .Where(m => m.SeasonId == seasonId)
                .Select(m => CountFor(m.UserMatchId, kind))
                .ToList();
            _seasonCounts[(userId, seasonId, betType)] = counts;
            if (counts.Count == 0) return counts;

            var distribution = counts
                .GroupBy(c => c)
                .Select(g => new UserSeasonEventDistribution
                {
                    UserId = userId, SeasonId = seasonId, BetType = betType,
                    Occurrences = g.Key, MatchCount = g.Count(),
                })
                .ToList();

            db.UserSeasonEventDistributions.AddRange(distribution);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // A concurrent recalculation cached the same season first — the values are identical.
            }
            foreach (var row in distribution)
                db.Entry(row).State = EntityState.Detached;

            return counts;
        }
    }
}
