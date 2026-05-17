using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class RosterStatsService : IRosterStatsService
{
    private readonly NhlStatsDbContext _db;

    public RosterStatsService(NhlStatsDbContext db)
    {
        _db = db;
    }

    public async Task<TopRosterPlayerDto?> GetTopGoalScorerAsync(int seasonId)
    {
        var top = await _db.UserMatchGoals
            .Where(g => g.UserMatch!.SeasonId == seasonId)
            .GroupBy(g => g.RosterPlayerId)
            .Select(g => new { RosterPlayerId = g.Key, Total = g.Sum(x => x.Count) })
            .OrderByDescending(x => x.Total)
            .FirstOrDefaultAsync();

        if (top == null) return null;

        var player = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .FirstOrDefaultAsync(rp => rp.Id == top.RosterPlayerId);

        return player == null ? null :
            new TopRosterPlayerDto(player.Id, player.FirstName, player.Surname,
                player.Team?.ShortName, top.Total);
    }

    public async Task<TopRosterPlayerDto?> GetTopPenaltyPlayerAsync(int seasonId)
    {
        var top = await _db.UserMatchPenalties
            .Where(p => p.UserMatch!.SeasonId == seasonId)
            .GroupBy(p => p.RosterPlayerId)
            .Select(g => new { RosterPlayerId = g.Key, Total = g.Sum(x => x.Count) })
            .OrderByDescending(x => x.Total)
            .FirstOrDefaultAsync();

        if (top == null) return null;

        var player = await _db.RosterPlayers
            .Include(rp => rp.Team)
            .FirstOrDefaultAsync(rp => rp.Id == top.RosterPlayerId);

        return player == null ? null :
            new TopRosterPlayerDto(player.Id, player.FirstName, player.Surname,
                player.Team?.ShortName, top.Total);
    }

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

    public async Task<IEnumerable<SeasonTopRosterPlayersDto>> GetTopRosterPlayersAsync()
    {
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

        var allPlayerIds = topScorersBySeason.Select(x => x.RosterPlayerId)
            .Union(topPpScorersBySeason.Select(x => x.RosterPlayerId))
            .Union(topShScorersBySeason.Select(x => x.RosterPlayerId))
            .Union(topPenaltyPlayersBySeasonRaw.Select(x => x.RosterPlayerId))
            .Union(topPenaltyPlayersBySeason.Select(x => x.RosterPlayerId))
            .ToList();

        var players = await _db.RosterPlayers
            .Where(rp => allPlayerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id);

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
}
