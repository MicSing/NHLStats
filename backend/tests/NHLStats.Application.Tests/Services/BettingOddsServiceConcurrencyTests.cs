using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

/// <summary>
/// Background odds recalculations start after every finished match. Sharing an
/// <see cref="OddsRecalculationLock"/>, they run one at a time, so an older pass (reading history
/// without the latest results) can never finish last and overwrite newer odds.
/// </summary>
public class BettingOddsServiceConcurrencyTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;

    public BettingOddsServiceConcurrencyTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        _db = new NhlStatsDbContext(new DbContextOptionsBuilder<NhlStatsDbContext>().UseSqlite(_connection).Options);
        _db.Database.EnsureCreated();

        var hosted = new Team { Name = "Hosted", ShortName = "HST" };
        var opp = new Team { Name = "Opp", ShortName = "OPP" };
        _db.Teams.AddRange(hosted, opp);
        _db.SaveChanges();
        var season = new Season { Name = "S", HostedTeamId = hosted.Id, StartedOn = DateTime.UtcNow.AddDays(-20) };
        _db.Seasons.Add(season);
        _db.SaveChanges();
        for (int i = 0; i < 4; i++)
            _db.Matches.Add(new Match
            {
                SeasonId = season.Id, MatchNumber = i + 1, HomeTeamId = hosted.Id, AwayTeamId = opp.Id,
                HomeScore = i % 2 == 0 ? 3 : 1, AwayScore = 2, CompletionType = CompletionType.RegularTime,
                MatchDate = DateTime.UtcNow.AddDays(-10 + i),
            });
        _db.Matches.Add(new Match
        {
            SeasonId = season.Id, MatchNumber = 100, HomeTeamId = hosted.Id, AwayTeamId = opp.Id,
            CompletionType = CompletionType.None, MatchDate = DateTime.UtcNow.AddDays(1),
        });
        _db.SaveChanges();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task Recalculation_waits_while_another_one_holds_the_lock()
    {
        var recalcLock = new OddsRecalculationLock();
        var service = new BettingOddsService(_db, recalcLock: recalcLock);

        var held = await recalcLock.AcquireAsync();
        var pass = service.RecalculateUpcomingAsync(1);
        await Task.Delay(200);

        pass.IsCompleted.Should().BeFalse("another recalculation is still running");
        (await _db.MatchOdds.AsNoTracking().AnyAsync()).Should().BeFalse();

        held.Dispose();
        await pass;

        (await _db.MatchOdds.AsNoTracking().AnyAsync()).Should().BeTrue();
    }

    [Fact]
    public async Task Lock_is_released_after_a_recalculation_so_the_next_one_runs()
    {
        var recalcLock = new OddsRecalculationLock();
        var service = new BettingOddsService(_db, recalcLock: recalcLock);

        await service.RecalculateUpcomingAsync(1);
        var second = service.RecalculateAllUpcomingAsync();

        (await Task.WhenAny(second, Task.Delay(TimeSpan.FromSeconds(10)))).Should().BeSameAs(second);
        (await second).Should().Be(1);
    }
}
