using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class MatchService : IMatchService
{
    private readonly NhlStatsDbContext _db;
    private readonly IBetService _betService;
    private readonly IBettingOddsService _oddsService;
    private readonly IUserMatchService _userMatchService;
    private readonly ISeasonEventBroadcaster? _broadcaster;
    private readonly IServiceScopeFactory? _scopeFactory;
    private readonly IOddsRecalculationTracker? _oddsTracker;

    public MatchService(NhlStatsDbContext db, IBetService betService, IBettingOddsService oddsService, IUserMatchService userMatchService)
    {
        _db = db;
        _betService = betService;
        _oddsService = oddsService;
        _userMatchService = userMatchService;
    }

    public MatchService(NhlStatsDbContext db, IBetService betService, IBettingOddsService oddsService, IUserMatchService userMatchService, ISeasonEventBroadcaster broadcaster)
        : this(db, betService, oddsService, userMatchService)
    {
        _broadcaster = broadcaster;
    }

    public MatchService(NhlStatsDbContext db, IBetService betService, IBettingOddsService oddsService, IUserMatchService userMatchService, ISeasonEventBroadcaster broadcaster, IServiceScopeFactory scopeFactory)
        : this(db, betService, oddsService, userMatchService, broadcaster)
    {
        _scopeFactory = scopeFactory;
    }

    public MatchService(NhlStatsDbContext db, IBetService betService, IBettingOddsService oddsService, IUserMatchService userMatchService, ISeasonEventBroadcaster broadcaster, IServiceScopeFactory scopeFactory, IOddsRecalculationTracker oddsTracker)
        : this(db, betService, oddsService, userMatchService, broadcaster, scopeFactory)
    {
        _oddsTracker = oddsTracker;
    }

    private async Task TryBroadcastAsync(SeasonEventNotificationDto evt)
    {
        if (_broadcaster == null) return;
        try
        {
            await _broadcaster.BroadcastEventAsync(evt);
        }
        catch
        {
            // best-effort: broadcast failures must never affect the write
        }
    }

    private static DateTime? NormalizeMatchDate(DateTime? matchDate, CompletionType completionType) =>
        completionType == CompletionType.None ? null : matchDate;

    private static MatchDto ToDto(Match m) => new(
        m.Id, m.SeasonId, m.MatchNumber,
        m.HomeTeamId, m.HomeTeam?.Name, m.HomeTeam?.ShortName,
        m.AwayTeamId, m.AwayTeam?.Name, m.AwayTeam?.ShortName,
        m.HomeScore, m.AwayScore, m.MatchDate, m.CompletionType, m.Phase, m.PlayoffRound);

    private static FutureMatchDto ToFutureDto(Match m) => new(
        m.Id,
        m.SeasonId,
        m.Season?.Name ?? string.Empty,
        m.MatchNumber,
        m.HomeTeamId,
        m.HomeTeam?.Name,
        m.AwayTeamId,
        m.AwayTeam?.Name,
        m.Season?.HostedTeamId,
        m.Phase,
        m.PlayoffRound,
        m.UserMatches?.Select(um => new UserMatchInfoDto(um.UserId, um.User?.Name)) ?? Enumerable.Empty<UserMatchInfoDto>());

    public async Task<IEnumerable<FutureMatchDto>> GetFutureMatchesAsync(int count = 10, string? loginId = null)
    {
        var normalizedCount = count <= 0 ? 10 : count;
        var now = DateTime.UtcNow;

        var matches = await _db.Matches
            .Include(m => m.Season)
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.UserMatches!)
                .ThenInclude(um => um.User)
            .Where(m => m.CompletionType == CompletionType.None)
            .Where(m => !m.MatchDate.HasValue || m.MatchDate.Value > now)
            .OrderBy(m => m.MatchDate == null)
            .ThenBy(m => m.MatchDate)
            .ThenByDescending(m => m.Season!.StartedOn)
            .ThenBy(m => m.MatchNumber)
            .Take(normalizedCount)
            .ToListAsync();

        return matches.Select(ToFutureDto);
    }

    public async Task<IEnumerable<MatchDto>> GetBySeasonAsync(int seasonId) =>
        await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => m.SeasonId == seasonId)
            .OrderBy(m => m.MatchNumber)
            .Select(m => ToDto(m))
            .ToListAsync();

    public async Task<MatchDto?> GetByIdAsync(int id)
    {
        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == id);
        return match == null ? null : ToDto(match);
    }

    public async Task<MatchDto> CreateAsync(int seasonId, CreateMatchDto dto)
    {
        var maxNumber = await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .MaxAsync(m => (int?)m.MatchNumber) ?? 0;

        var match = new Match
        {
            SeasonId = seasonId,
            MatchNumber = maxNumber + 1,
            HomeTeamId = dto.HomeTeamId,
            AwayTeamId = dto.AwayTeamId,
            HomeScore = 0,
            AwayScore = 0,
            MatchDate = null,
            CompletionType = CompletionType.None
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();
        return await GetByIdAsync(match.Id) ?? ToDto(match);
    }

    public async Task<MatchDto?> UpdateAsync(int id, UpdateMatchDto dto)
    {
        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == id);
        if (match == null) return null;

        if (!IsValidTransition(match.CompletionType, dto.CompletionType))
            throw new InvalidOperationException(
                $"Invalid match status transition: {match.CompletionType} → {dto.CompletionType}");

        var previousCompletionType = match.CompletionType;

        match.HomeTeamId = dto.HomeTeamId;
        match.AwayTeamId = dto.AwayTeamId;
        match.HomeScore = dto.HomeScore;
        match.AwayScore = dto.AwayScore;
        match.CompletionType = dto.CompletionType;
        match.MatchDate = NormalizeMatchDate(dto.MatchDate, dto.CompletionType);
        match.Phase = dto.Phase;
        match.PlayoffRound = dto.Phase == MatchPhase.Playoff ? dto.PlayoffRound : null;
        await _db.SaveChangesAsync();

        var justCompleted = previousCompletionType is CompletionType.None or CompletionType.InProgress
            && dto.CompletionType is CompletionType.RegularTime or CompletionType.Overtime or CompletionType.Shootout;

        if (justCompleted)
        {
            var season = await _db.Seasons.FindAsync(match.SeasonId);
            await _userMatchService.ApplyMatchEndAutoPointsAsync(
                id, dto.HomeScore, dto.AwayScore,
                season?.HostedTeamId, match.HomeTeamId);

            await _betService.EvaluateMatchBetsAsync(id);
            await HandleMatchCompletedAsync(match, season);
            await TryBroadcastAsync(new SeasonEventNotificationDto(
                SeasonId: match.SeasonId,
                MatchId: match.Id,
                UserMatchId: 0,
                ActorUserId: null,
                ActorUserName: null,
                EventType: "MatchCompleted",
                EventSubType: dto.CompletionType.ToString(),
                PlayerName: null,
                Count: 0,
                HomeTeamName: match.HomeTeam?.Name,
                AwayTeamName: match.AwayTeam?.Name,
                HomeScore: match.HomeScore,
                AwayScore: match.AwayScore));
        }

        return await GetByIdAsync(id);
    }

    public async Task HandleMatchCompletedAsync(int matchId)
    {
        var match = await _db.Matches.FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return;
        var season = await _db.Seasons.FindAsync(match.SeasonId);
        await HandleMatchCompletedAsync(match, season);
    }

    private async Task HandleMatchCompletedAsync(Match match, Season? season)
    {
        var appendedMatchId = season == null ? null : await TryAppendNextPlayoffGameAsync(match, season);
        await RecalculateUpcomingOddsAsync(
            match.SeasonId,
            appendedMatchId is int newId ? [newId] : [],
            7);
    }

    // Calculates odds for newly created matches first (tracked, so admins can see progress),
    // then refreshes the globally upcoming ones. Both run in one sequential pass so the two
    // never upsert the same MatchOdds rows concurrently.
    private async Task RecalculateUpcomingOddsAsync(int seasonId, IReadOnlyCollection<int> newMatchIds, int count = 7)
    {
        _oddsTracker?.MarkQueued(seasonId, newMatchIds);

        if (_scopeFactory != null)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var oddsService = scope.ServiceProvider.GetRequiredService<IBettingOddsService>();
                    await CalculateOddsForMatchesAsync(oddsService, newMatchIds);
                    await oddsService.RecalculateUpcomingAsync(count);
                }
                catch (Exception ex)
                {
                    foreach (var matchId in newMatchIds)
                        if (IsTrackedAsPending(seasonId, matchId))
                            _oddsTracker?.MarkFailed(matchId, ex.Message);
                    Console.Error.WriteLine($"Failed to recalculate upcoming odds in background: {ex}");
                }
            });
            await Task.CompletedTask;
        }
        else
        {
            await CalculateOddsForMatchesAsync(_oddsService, newMatchIds);
            await _oddsService.RecalculateUpcomingAsync(count);
        }
    }

    private bool IsTrackedAsPending(int seasonId, int matchId) =>
        _oddsTracker?.GetSeasonStatus(seasonId).PendingMatchIds.Contains(matchId) ?? false;

    private async Task CalculateOddsForMatchesAsync(IBettingOddsService oddsService, IEnumerable<int> matchIds)
    {
        foreach (var matchId in matchIds)
        {
            _oddsTracker?.MarkRunning(matchId);
            try
            {
                await oddsService.RecalculateForMatchAsync(matchId);
                _oddsTracker?.MarkDone(matchId);
            }
            catch (Exception ex)
            {
                _oddsTracker?.MarkFailed(matchId, ex.Message);
                Console.Error.WriteLine($"Failed to calculate odds for match {matchId}: {ex}");
            }
        }
    }

    public async Task<MatchDto?> ResetAsync(int id)
    {
        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == id);
        if (match == null) return null;

        await _userMatchService.ResetStatsForMatchAsync(id);
        await _betService.ResetMatchBetsAsync(id);

        match.HomeScore = 0;
        match.AwayScore = 0;
        match.CompletionType = CompletionType.None;
        match.MatchDate = null;
        await _db.SaveChangesAsync();

        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var match = await _db.Matches.FindAsync(id);
        if (match == null) return false;

        _db.Matches.Remove(match);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<MatchDto>> BatchCreateAsync(int seasonId, IEnumerable<BatchCreateMatchDto> dtos)
    {
        var dtoList = dtos.ToList();

        // Validate all team IDs upfront
        var allTeamIds = dtoList
            .SelectMany(d => new[] { d.HomeTeamId, d.AwayTeamId })
            .Distinct()
            .ToList();

        var validTeamIds = await _db.Teams
            .Where(t => allTeamIds.Contains(t.Id))
            .Select(t => t.Id)
            .ToListAsync();

        var invalidIds = allTeamIds.Except(validTeamIds).ToList();
        if (invalidIds.Count > 0)
            throw new ArgumentException($"Invalid team IDs: {string.Join(", ", invalidIds)}");

        var startNumber = await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .MaxAsync(m => (int?)m.MatchNumber) ?? 0;

        var matches = dtoList.Select((dto, i) => new Match
        {
            SeasonId = seasonId,
            MatchNumber = startNumber + i + 1,
            HomeTeamId = dto.HomeTeamId,
            AwayTeamId = dto.AwayTeamId,
            HomeScore = dto.HomeScore,
            AwayScore = dto.AwayScore,
            CompletionType = dto.CompletionType,
            MatchDate = NormalizeMatchDate(dto.MatchDate, dto.CompletionType)
        }).ToList();

        _db.Matches.AddRange(matches);
        await _db.SaveChangesAsync();

        // Create UserMatch records for player points
        var userMatches = new List<UserMatch>();
        var userPointsPairs = new List<(UserMatch um, BatchUserPointsDto points)>();
        for (int i = 0; i < dtoList.Count; i++)
        {
            var dto = dtoList[i];
            var match = matches[i];
            if (dto.UserPoints != null)
            {
                foreach (var up in dto.UserPoints)
                {
                    var um = new UserMatch
                    {
                        UserId = up.UserId,
                        MatchId = match.Id,
                        SeasonId = seasonId
                    };
                    userMatches.Add(um);
                    userPointsPairs.Add((um, up));
                }
            }
        }
        if (userMatches.Count > 0)
        {
            _db.UserMatches.AddRange(userMatches);
            await _db.SaveChangesAsync();

            // Create UserMatchPoint records so reasons are visible in the UI.
            // Negative points → PointReason Id=1 ("Penalty", IsPositive=false)
            // Positive points → PointReason Id=9 ("Penalty", IsPositive=true)
            var pointEntries = new List<UserMatchPoint>();
            foreach (var (um, up) in userPointsPairs)
            {
                if (up.Minus > 0)
                    pointEntries.Add(new UserMatchPoint { UserMatchId = um.Id, PointReasonId = 1, Count = up.Minus });
                if (up.Plus > 0)
                    pointEntries.Add(new UserMatchPoint { UserMatchId = um.Id, PointReasonId = 9, Count = up.Plus });
            }
            if (pointEntries.Count > 0)
            {
                _db.UserMatchPoints.AddRange(pointEntries);
                await _db.SaveChangesAsync();
            }
        }

        // Reload with navigation properties
        var ids = matches.Select(m => m.Id).ToList();
        var created = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => ids.Contains(m.Id))
            .OrderBy(m => m.MatchNumber)
            .ToListAsync();

        return created.Select(ToDto);
    }

    // Standard 2-2-1-1-1 playoff format, expressed as whether the hosted team is home in each game.
    private static readonly bool[] PlayoffSeriesHostedIsHomePattern = [true, true, false, false, true, false, true];

    // A new series starts with the games every best-of-7 needs; games 5-7 are appended one at a
    // time by TryAppendNextPlayoffGameAsync while the series is still undecided.
    private const int InitialPlayoffGames = 4;

    // IIHF playoff rounds are single games (quarterfinal, semifinal, final); everything else is
    // treated as an NHL best-of-7 over four rounds. Mirrors PlayoffBracket.tsx on the frontend.
    private static int PlayoffWinsNeeded(LeagueType leagueType) => leagueType == LeagueType.IIHF ? 1 : 4;
    private static int MaxPlayoffGames(LeagueType leagueType) => leagueType == LeagueType.IIHF ? 1 : 7;
    private static int MaxPlayoffRounds(LeagueType leagueType) => leagueType == LeagueType.IIHF ? 3 : 4;

    private static bool IsDecided(CompletionType completionType) =>
        completionType is CompletionType.RegularTime or CompletionType.Overtime or CompletionType.Shootout;

    private static (int hostedWins, int opponentWins) CountSeriesWins(IEnumerable<Match> roundMatches, int hostedTeamId)
    {
        int hostedWins = 0, opponentWins = 0;
        foreach (var m in roundMatches.Where(m => IsDecided(m.CompletionType) && m.HomeScore != m.AwayScore))
        {
            var winnerId = m.HomeScore > m.AwayScore ? m.HomeTeamId : m.AwayTeamId;
            if (winnerId == hostedTeamId) hostedWins++;
            else opponentWins++;
        }
        return (hostedWins, opponentWins);
    }

    /// <summary>
    /// After a playoff game finishes, appends the next game of the series when nobody has won it
    /// yet and no unplayed game is left in the round. Returns the id of the appended match, if any.
    /// </summary>
    private async Task<int?> TryAppendNextPlayoffGameAsync(Match completed, Season season)
    {
        if (completed.Phase != MatchPhase.Playoff || completed.PlayoffRound is not int round || season.HostedTeamId is not int hostedTeamId)
            return null;

        var roundMatches = await _db.Matches
            .Where(m => m.SeasonId == completed.SeasonId && m.Phase == MatchPhase.Playoff && m.PlayoffRound == round)
            .OrderBy(m => m.MatchNumber)
            .ToListAsync();

        var first = roundMatches[0];
        if (first.HomeTeamId != hostedTeamId && first.AwayTeamId != hostedTeamId)
            return null;

        var (hostedWins, opponentWins) = CountSeriesWins(roundMatches, hostedTeamId);
        var winsNeeded = PlayoffWinsNeeded(season.LeagueType);
        if (hostedWins >= winsNeeded || opponentWins >= winsNeeded)
            return null;
        if (roundMatches.Any(m => !IsDecided(m.CompletionType)))
            return null;
        var gameIndex = roundMatches.Count;
        if (gameIndex >= MaxPlayoffGames(season.LeagueType))
            return null;

        var startsHome = first.HomeTeamId == hostedTeamId;
        var opponentTeamId = startsHome ? first.AwayTeamId : first.HomeTeamId;
        var hostedIsHome = startsHome ? PlayoffSeriesHostedIsHomePattern[gameIndex] : !PlayoffSeriesHostedIsHomePattern[gameIndex];
        var maxNumber = await _db.Matches
            .Where(m => m.SeasonId == completed.SeasonId)
            .MaxAsync(m => (int?)m.MatchNumber) ?? 0;

        var next = new Match
        {
            SeasonId = completed.SeasonId,
            MatchNumber = maxNumber + 1,
            HomeTeamId = hostedIsHome ? hostedTeamId : opponentTeamId,
            AwayTeamId = hostedIsHome ? opponentTeamId : hostedTeamId,
            HomeScore = 0,
            AwayScore = 0,
            MatchDate = null,
            CompletionType = CompletionType.None,
            Phase = MatchPhase.Playoff,
            PlayoffRound = round
        };
        _db.Matches.Add(next);
        await _db.SaveChangesAsync();
        return next.Id;
    }

    public async Task<PlayoffStatusDto> GetPlayoffStatusAsync(int seasonId)
    {
        var none = new PlayoffStatusDto(null, 0, 0, false, false, false, null);

        var season = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == seasonId);
        if (season?.HostedTeamId is not int hostedTeamId) return none;

        var lastRound = await _db.Matches
            .Where(m => m.SeasonId == seasonId && m.Phase == MatchPhase.Playoff)
            .MaxAsync(m => m.PlayoffRound);
        if (lastRound is not int round) return none;

        var roundMatches = await _db.Matches
            .AsNoTracking()
            .Where(m => m.SeasonId == seasonId && m.Phase == MatchPhase.Playoff && m.PlayoffRound == round)
            .ToListAsync();

        var (hostedWins, opponentWins) = CountSeriesWins(roundMatches, hostedTeamId);
        var winsNeeded = PlayoffWinsNeeded(season.LeagueType);
        var hostedTeamWon = hostedWins >= winsNeeded;
        var decided = hostedTeamWon || opponentWins >= winsNeeded;
        var canCreateNext = hostedTeamWon && round < MaxPlayoffRounds(season.LeagueType);

        return new PlayoffStatusDto(
            round, hostedWins, opponentWins, decided, hostedTeamWon, canCreateNext,
            canCreateNext ? round + 1 : null);
    }

    public async Task<IEnumerable<MatchDto>> CreatePlayoffSeriesAsync(int seasonId, CreatePlayoffSeriesDto dto)
    {
        var season = await _db.Seasons.FindAsync(seasonId);
        if (season == null)
            throw new ArgumentException($"Season {seasonId} not found");
        if (season.HostedTeamId == null)
            throw new ArgumentException("Season has no hosted team configured");

        var hostedTeamId = season.HostedTeamId.Value;
        if (dto.OpponentTeamId == hostedTeamId)
            throw new ArgumentException("Opponent team must be different from the hosted team");

        var opponentExists = await _db.Teams.AnyAsync(t => t.Id == dto.OpponentTeamId);
        if (!opponentExists)
            throw new ArgumentException($"Invalid team ID: {dto.OpponentTeamId}");

        var startNumber = await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .MaxAsync(m => (int?)m.MatchNumber) ?? 0;

        // Each call creates one full round of the hosted team's playoff run.
        var round = (await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .MaxAsync(m => (int?)m.PlayoffRound) ?? 0) + 1;

        var initialGames = Math.Min(InitialPlayoffGames, MaxPlayoffGames(season.LeagueType));
        var matches = PlayoffSeriesHostedIsHomePattern.Take(initialGames).Select((baseHostedIsHome, i) =>
        {
            var hostedIsHome = dto.StartsHome ? baseHostedIsHome : !baseHostedIsHome;
            var matchNumber = startNumber + i + 1;
            return new Match
            {
                SeasonId = seasonId,
                MatchNumber = matchNumber,
                HomeTeamId = hostedIsHome ? hostedTeamId : dto.OpponentTeamId,
                AwayTeamId = hostedIsHome ? dto.OpponentTeamId : hostedTeamId,
                HomeScore = 0,
                AwayScore = 0,
                MatchDate = null,
                CompletionType = CompletionType.None,
                Phase = MatchPhase.Playoff,
                PlayoffRound = round
            };
        }).ToList();

        _db.Matches.AddRange(matches);
        await _db.SaveChangesAsync();

        var ids = matches.Select(m => m.Id).ToList();
        await RecalculateUpcomingOddsAsync(seasonId, ids, 7);

        var created = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => ids.Contains(m.Id))
            .OrderBy(m => m.MatchNumber)
            .ToListAsync();

        return created.Select(ToDto);
    }

    private static bool IsValidTransition(CompletionType from, CompletionType to)
    {
        if (from == to) return true;
        return (from, to) switch
        {
            (CompletionType.None, CompletionType.InProgress) => true,
            (CompletionType.InProgress, CompletionType.RegularTime) => true,
            (CompletionType.InProgress, CompletionType.Overtime) => true,
            (CompletionType.InProgress, CompletionType.Shootout) => true,
            _ => false,
        };
    }
}
