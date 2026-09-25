using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

/// <summary>
/// Previous-season user history is cached as UserSeasonEventDistribution rows: built on first use,
/// read instead of the raw match data afterwards, and dropped when that season's stats change.
/// </summary>
public class BettingOddsServiceSeasonHistoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BettingOddsService _service;

    public BettingOddsServiceSeasonHistoryTests()
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

    private record Setup(Season Previous, Season Current, User User, RosterPlayer Player, Match Upcoming, List<UserMatch> PreviousUserMatches);

    private Setup Seed()
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);
        var user = new User { Name = "Player" };
        _db.Users.Add(user);
        _db.SaveChanges();

        var previous = new Season { Name = "S1", HostedTeamId = home.Id, StartedOn = DateTime.UtcNow.AddYears(-1) };
        var current = new Season { Name = "S2", HostedTeamId = home.Id, StartedOn = DateTime.UtcNow };
        _db.Seasons.AddRange(previous, current);
        _db.SaveChanges();
        _db.SeasonUsers.AddRange(
            new SeasonUser { SeasonId = previous.Id, UserId = user.Id },
            new SeasonUser { SeasonId = current.Id, UserId = user.Id });

        var player = new RosterPlayer { TeamId = home.Id, FirstName = "Roster", Surname = "Player" };
        _db.RosterPlayers.Add(player);
        _db.SaveChanges();

        var previousUserMatches = SeedPenaltyHistory(previous, home, away, user, player, 1, 0, 2, 0, 1, 0);
        SeedPenaltyHistory(current, home, away, user, player, 1, 0, 0, 1);

        var upcoming = new Match
        {
            SeasonId = current.Id, MatchNumber = 100, HomeTeamId = home.Id, AwayTeamId = away.Id,
            CompletionType = CompletionType.None,
        };
        _db.Matches.Add(upcoming);
        _db.SaveChanges();

        return new Setup(previous, current, user, player, upcoming, previousUserMatches);
    }

    private List<UserMatch> SeedPenaltyHistory(Season season, Team home, Team away, User user, RosterPlayer player, params int[] countsPerMatch)
    {
        var userMatches = new List<UserMatch>();
        for (int i = 0; i < countsPerMatch.Length; i++)
        {
            var match = new Match
            {
                SeasonId = season.Id, MatchNumber = i + 1, HomeTeamId = home.Id, AwayTeamId = away.Id,
                HomeScore = 3, AwayScore = 1, CompletionType = CompletionType.RegularTime,
                MatchDate = season.StartedOn.AddDays(i),
            };
            _db.Matches.Add(match);
            _db.SaveChanges();

            var userMatch = new UserMatch { UserId = user.Id, MatchId = match.Id, SeasonId = season.Id };
            _db.UserMatches.Add(userMatch);
            _db.SaveChanges();
            userMatches.Add(userMatch);

            if (countsPerMatch[i] > 0)
            {
                _db.UserMatchPenalties.Add(new UserMatchPenalty { UserMatchId = userMatch.Id, RosterPlayerId = player.Id, Count = countsPerMatch[i] });
                _db.SaveChanges();
            }
        }
        return userMatches;
    }

    private Task<MatchOdds> PenaltyRowAsync(Setup s) =>
        _db.MatchOdds.AsNoTracking().SingleAsync(o =>
            o.MatchId == s.Upcoming.Id && o.BetType == OddsBetType.UserPenalty && o.TargetId == s.User.Id);

    [Fact]
    public async Task Recalculation_caches_previous_season_distribution()
    {
        var s = Seed();

        await _service.RecalculateForMatchAsync(s.Upcoming.Id);

        var rows = await _db.UserSeasonEventDistributions.AsNoTracking()
            .Where(d => d.UserId == s.User.Id && d.SeasonId == s.Previous.Id && d.BetType == OddsBetType.UserPenalty)
            .ToDictionaryAsync(d => d.Occurrences, d => d.MatchCount);
        rows.Should().BeEquivalentTo(new Dictionary<int, int> { [0] = 3, [1] = 2, [2] = 1 });
        (await _db.UserSeasonEventDistributions.AnyAsync(d => d.SeasonId == s.Current.Id))
            .Should().BeFalse("the current season is always read live");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Previous_season_rate_matches_the_raw_history(bool cacheAlreadyBuilt)
    {
        var s = Seed();
        if (cacheAlreadyBuilt) await _service.RecalculateForMatchAsync(s.Upcoming.Id);

        await _service.RecalculateForMatchAsync(s.Upcoming.Id);

        // Penalties per match — previous season 1,0,2,0,1,0 (4/6), current 1,0,0,1 (2/4),
        // last 10 across both seasons 6/10: P = 0.10*4/6 + 0.65*2/4 + 0.25*6/10.
        var expected = 0.10m * (4m / 6m) + 0.65m * (2m / 4m) + 0.25m * (6m / 10m);
        (await PenaltyRowAsync(s)).Probability.Should().BeApproximately(expected, 0.0001m);
    }

    [Fact]
    public async Task Recalculation_reads_the_cache_instead_of_raw_history()
    {
        var s = Seed();
        await _service.RecalculateForMatchAsync(s.Upcoming.Id);
        var before = await PenaltyRowAsync(s);

        // Change the cached distribution directly (no invalidation): recalculated odds must follow it.
        var cached = await _db.UserSeasonEventDistributions
            .Where(d => d.SeasonId == s.Previous.Id && d.BetType == OddsBetType.UserPenalty)
            .ToListAsync();
        _db.UserSeasonEventDistributions.RemoveRange(cached);
        _db.UserSeasonEventDistributions.Add(new UserSeasonEventDistribution
        {
            UserId = s.User.Id, SeasonId = s.Previous.Id, BetType = OddsBetType.UserPenalty, Occurrences = 1, MatchCount = 6,
        });
        await _db.SaveChangesAsync();

        await _service.RecalculateForMatchAsync(s.Upcoming.Id);

        (await PenaltyRowAsync(s)).Probability.Should().NotBe(before.Probability);
    }

    [Fact]
    public async Task Changing_a_previous_season_stat_drops_that_seasons_cache()
    {
        var s = Seed();
        await _service.RecalculateForMatchAsync(s.Upcoming.Id);
        (await _db.UserSeasonEventDistributions.AnyAsync(d => d.SeasonId == s.Previous.Id)).Should().BeTrue();

        _db.UserMatchPenalties.Add(new UserMatchPenalty { UserMatchId = s.PreviousUserMatches[1].Id, RosterPlayerId = s.Player.Id, Count = 1 });
        await _db.SaveChangesAsync();

        (await _db.UserSeasonEventDistributions.AnyAsync(d => d.SeasonId == s.Previous.Id)).Should().BeFalse();

        await _service.RecalculateForMatchAsync(s.Upcoming.Id);
        var rebuilt = await _db.UserSeasonEventDistributions.AsNoTracking()
            .Where(d => d.UserId == s.User.Id && d.SeasonId == s.Previous.Id && d.BetType == OddsBetType.UserPenalty)
            .ToDictionaryAsync(d => d.Occurrences, d => d.MatchCount);
        rebuilt.Should().BeEquivalentTo(new Dictionary<int, int> { [0] = 2, [1] = 3, [2] = 1 });
    }

    [Fact]
    public async Task Changing_a_match_completion_drops_that_seasons_cache()
    {
        var s = Seed();
        await _service.RecalculateForMatchAsync(s.Upcoming.Id);

        var match = await _db.Matches.SingleAsync(m => m.Id == s.PreviousUserMatches[0].MatchId);
        match.CompletionType = CompletionType.None;
        await _db.SaveChangesAsync();

        (await _db.UserSeasonEventDistributions.AnyAsync(d => d.SeasonId == s.Previous.Id)).Should().BeFalse();
    }
}
