using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NHLStats.Application.Caching;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class StatsCacheTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly StatsCache _cache = new(new MemoryCache(new MemoryCacheOptions()));

    public StatsCacheTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .AddInterceptors(new StatsCacheInvalidationInterceptor(_cache))
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private int _computations;

    private Task<int> CountUsersAsync() =>
        _cache.GetOrCreateAsync("users", async () =>
        {
            _computations++;
            return await _db.Users.CountAsync();
        });

    [Fact]
    public async Task Serves_a_cached_value_while_data_is_unchanged()
    {
        (await CountUsersAsync()).Should().Be(0);
        (await CountUsersAsync()).Should().Be(0);

        _computations.Should().Be(1);
    }

    [Fact]
    public async Task A_data_change_makes_the_next_read_recompute()
    {
        await CountUsersAsync();

        _db.Users.Add(new User { Name = "New" });
        await _db.SaveChangesAsync();

        (await CountUsersAsync()).Should().Be(1);
        _computations.Should().Be(2);
    }

    [Fact]
    public async Task Writing_only_precomputed_odds_keeps_the_cache()
    {
        var home = new Team { Name = "H", ShortName = "H" };
        var away = new Team { Name = "A", ShortName = "A" };
        _db.Teams.AddRange(home, away);
        var season = new Season { Name = "S", StartedOn = DateTime.UtcNow };
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();
        var match = new Match { SeasonId = season.Id, MatchNumber = 1, HomeTeamId = home.Id, AwayTeamId = away.Id };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();

        await CountUsersAsync();
        _db.MatchOdds.Add(new MatchOdds { MatchId = match.Id, BetType = OddsBetType.Draw, Probability = 0.2m, Odds = 4m, ComputedOn = DateTime.UtcNow });
        await _db.SaveChangesAsync();
        await CountUsersAsync();

        _computations.Should().Be(1);
    }
}
