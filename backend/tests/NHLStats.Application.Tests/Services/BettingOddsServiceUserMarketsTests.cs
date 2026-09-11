using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

/// <summary>
/// Covers BettingOddsService.BuildUserOddsDtosAsync's occasions-bumping fix: a user whose
/// "at least once" (occasions=1) market falls below BettingConstants.MinBettableOdds must still
/// be listed if a higher occasions threshold (2+, 3+, ...) clears it, and only left out entirely
/// when nothing up to 30 does.
/// </summary>
public class BettingOddsServiceUserMarketsTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BettingOddsService _service;

    public BettingOddsServiceUserMarketsTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();
        _service = new BettingOddsService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private (Team home, Team away, Season season, User user) SeedSeasonWithUser()
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);
        _db.SaveChanges();

        var season = new Season { Name = "S1", HostedTeamId = home.Id, StartedOn = DateTime.UtcNow };
        _db.Seasons.Add(season);
        _db.SaveChanges();

        var user = new User { Name = "Player" };
        _db.Users.Add(user);
        _db.SaveChanges();
        _db.SeasonUsers.Add(new SeasonUser { SeasonId = season.Id, UserId = user.Id });
        _db.SaveChanges();

        var player = new RosterPlayer { TeamId = home.Id, FirstName = "Roster", Surname = "Player" };
        _db.RosterPlayers.Add(player);
        _db.SaveChanges();
        _db.SeasonRosterPlayers.Add(new SeasonRosterPlayer { SeasonId = season.Id, RosterPlayerId = player.Id, TeamId = home.Id });
        _db.SaveChanges();

        return (home, away, season, user);
    }

    /// <summary>Seeds `count` completed matches with the given per-match penalty counts for the user.</summary>
    private void SeedPenaltyHistory(Season season, Team home, Team away, User user, RosterPlayer player, params int[] countsPerMatch)
    {
        for (int i = 0; i < countsPerMatch.Length; i++)
        {
            var match = new Match
            {
                SeasonId = season.Id,
                MatchNumber = i + 1,
                HomeTeamId = home.Id,
                AwayTeamId = away.Id,
                HomeScore = 3,
                AwayScore = 1,
                MatchDate = DateTime.UtcNow.AddDays(-(countsPerMatch.Length - i)),
                CompletionType = CompletionType.RegularTime
            };
            _db.Matches.Add(match);
            _db.SaveChanges();

            var userMatch = new UserMatch { UserId = user.Id, MatchId = match.Id, SeasonId = season.Id };
            _db.UserMatches.Add(userMatch);
            _db.SaveChanges();

            if (countsPerMatch[i] > 0)
            {
                _db.UserMatchPenalties.Add(new UserMatchPenalty { UserMatchId = userMatch.Id, RosterPlayerId = player.Id, Count = countsPerMatch[i] });
                _db.SaveChanges();
            }
        }
    }

    private Match SeedUpcomingMatch(Season season, Team home, Team away)
    {
        var match = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 100,
            HomeTeamId = home.Id,
            AwayTeamId = away.Id,
            CompletionType = CompletionType.None
        };
        _db.Matches.Add(match);
        _db.SaveChanges();
        return match;
    }

    [Fact]
    public async Task UserWithTooShortOccasions1Market_StillListed_AtABumpedOccasionsThreshold()
    {
        var (home, away, season, user) = SeedSeasonWithUser();
        var player = await _db.RosterPlayers.FirstAsync();

        // 8 matches with 1 penalty, 2 with 2 penalties: occasions=1 "rate" = mean = 1.2 (clamped to
        // 0.99, odds ~1.00 — below the 1.08 floor); occasions=2 rate = 2/10 = 0.20 (odds ~2.40 — clears it).
        SeedPenaltyHistory(season, home, away, user, player, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2);
        var upcoming = SeedUpcomingMatch(season, home, away);

        var odds = await _service.GetMatchOddsAsync(upcoming.Id);

        odds.Should().NotBeNull();
        var entry = odds!.UserPenalty.Should().ContainSingle(u => u.UserId == user.Id).Subject;
        entry.MinOccasions.Should().Be(2, "occasions=1 falls below the floor but occasions=2 clears it");
        entry.EffectiveOdds.Should().BeGreaterThanOrEqualTo(BettingConstants.MinBettableOdds);
    }

    [Fact]
    public async Task UserWithNoBettableThresholdAtAll_IsExcluded()
    {
        var (home, away, season, user) = SeedSeasonWithUser();
        var player = await _db.RosterPlayers.FirstAsync();

        // Every match has 35 penalties — every occasions threshold from 1 to 30 has a 100% hit
        // rate (clamped to 0.99), so odds stay under 1.08 no matter how high occasions is bumped.
        SeedPenaltyHistory(season, home, away, user, player, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35);
        var upcoming = SeedUpcomingMatch(season, home, away);

        var odds = await _service.GetMatchOddsAsync(upcoming.Id);

        odds.Should().NotBeNull();
        odds!.UserPenalty.Should().NotContain(u => u.UserId == user.Id, "no occasions threshold up to 30 ever clears MinBettableOdds for this user");
    }

    [Fact]
    public async Task UserBelowMinBettableProbability_IsStillExcluded()
    {
        var (home, away, season, user) = SeedSeasonWithUser();
        var player = await _db.RosterPlayers.FirstAsync();

        // Never takes a penalty — occasions=1 probability is 0, below MinBettableProbability,
        // excluded by the earlier (unchanged) guard before the occasions-bumping logic even runs.
        SeedPenaltyHistory(season, home, away, user, player, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        var upcoming = SeedUpcomingMatch(season, home, away);

        var odds = await _service.GetMatchOddsAsync(upcoming.Id);

        odds.Should().NotBeNull();
        odds!.UserPenalty.Should().NotContain(u => u.UserId == user.Id);
    }
}
