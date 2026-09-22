using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class RealSeasonMatchImportServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;

    public RealSeasonMatchImportServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private sealed class FakeNhlScheduleClient : INhlScheduleClient
    {
        public List<NhlGameDto> Games { get; set; } = [];

        public Task<IReadOnlyList<NhlGameDto>> GetRegularSeasonGamesAsync(int nhlYear, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<NhlGameDto>>(Games);
    }

    [Fact]
    public async Task ImportAsync_WhenSeasonHasNoNhlYear_ReturnsError()
    {
        var season = new Season { Name = "Test Season", StartedOn = DateTime.UtcNow };
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();

        var service = new RealSeasonMatchImportService(_db, new FakeNhlScheduleClient());

        var (result, error) = await service.ImportAsync(season.Id);

        result.Should().BeNull();
        error.Should().Contain("NHL year");
    }

    [Fact]
    public async Task ImportAsync_CreatesMatchesForMappedTeamsAndSkipsUnmappedOnes()
    {
        var edm = new Team { Name = "Edmonton Oilers", ShortName = "EDM" };
        var tor = new Team { Name = "Toronto Maple Leafs", ShortName = "TOR" };
        var season = new Season { Name = "NHL 26 Season", StartedOn = DateTime.UtcNow, NhlYear = 26 };
        _db.Teams.AddRange(edm, tor);
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();

        var gameDate = new DateTime(2025, 10, 8, 0, 0, 0, DateTimeKind.Utc);
        var client = new FakeNhlScheduleClient
        {
            Games =
            [
                new NhlGameDto(2025020001, "TOR", "EDM", gameDate),
                new NhlGameDto(2025020002, "UTA", "EDM", gameDate.AddDays(1)) // UTA isn't a seeded team here
            ]
        };
        var service = new RealSeasonMatchImportService(_db, client);

        var (result, error) = await service.ImportAsync(season.Id);

        error.Should().BeNull();
        result.Should().NotBeNull();
        result!.Imported.Should().Be(1);
        result.Skipped.Should().Be(1);
        result.Errors.Should().ContainSingle(e => e.Contains("UTA"));

        var matches = await _db.Matches.Where(m => m.SeasonId == season.Id).ToListAsync();
        matches.Should().HaveCount(1);
        matches[0].HomeTeamId.Should().Be(tor.Id);
        matches[0].AwayTeamId.Should().Be(edm.Id);
        matches[0].NhlGameId.Should().Be(2025020001);
        matches[0].MatchDate.Should().Be(gameDate);
    }

    [Fact]
    public async Task ImportAsync_RunTwice_DoesNotDuplicateAlreadyImportedGames()
    {
        var edm = new Team { Name = "Edmonton Oilers", ShortName = "EDM" };
        var tor = new Team { Name = "Toronto Maple Leafs", ShortName = "TOR" };
        var season = new Season { Name = "NHL 26 Season", StartedOn = DateTime.UtcNow, NhlYear = 26 };
        _db.Teams.AddRange(edm, tor);
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();

        var client = new FakeNhlScheduleClient
        {
            Games = [new NhlGameDto(2025020001, "TOR", "EDM", DateTime.UtcNow)]
        };
        var service = new RealSeasonMatchImportService(_db, client);

        await service.ImportAsync(season.Id);
        var (result, error) = await service.ImportAsync(season.Id);

        error.Should().BeNull();
        result!.Imported.Should().Be(0);
        result.Skipped.Should().Be(1);

        var matches = await _db.Matches.Where(m => m.SeasonId == season.Id).ToListAsync();
        matches.Should().HaveCount(1);
    }
}
