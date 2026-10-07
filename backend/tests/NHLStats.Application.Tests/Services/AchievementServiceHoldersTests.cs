using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class AchievementServiceHoldersTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly AchievementService _service;

    public AchievementServiceHoldersTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        _service = new AchievementService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task GetAchievementHolders_ShouldListOnlyUsersWhoEarnedEachAchievement()
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);

        var season = new Season { Name = "Season 1", Status = SeasonStatus.Active, StartedOn = new DateTime(2025, 1, 1) };
        _db.Seasons.Add(season);

        var offsider = new User { Name = "Offsider" };
        var clean = new User { Name = "Clean" };
        _db.Users.AddRange(offsider, clean);

        var offsideReason = await _db.PointReasons.FirstOrDefaultAsync(r => r.PointType == PointType.Negative && r.Name == "Offside")
            ?? new PointReason { Name = "Offside", PointType = PointType.Negative, IsActive = true };
        if (offsideReason.Id == 0) _db.PointReasons.Add(offsideReason);

        await _db.SaveChangesAsync();

        var match = new Match
        {
            SeasonId = season.Id,
            HomeTeamId = home.Id,
            AwayTeamId = away.Id,
            MatchDate = new DateTime(2025, 1, 2),
            MatchNumber = 1,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();

        var offsiderMatch = new UserMatch { MatchId = match.Id, SeasonId = season.Id, UserId = offsider.Id };
        var cleanMatch = new UserMatch { MatchId = match.Id, SeasonId = season.Id, UserId = clean.Id };
        _db.UserMatches.AddRange(offsiderMatch, cleanMatch);
        await _db.SaveChangesAsync();

        _db.UserMatchPoints.Add(new UserMatchPoint
        {
            UserMatchId = offsiderMatch.Id,
            PointReasonId = offsideReason.Id,
            Count = 1
        });
        await _db.SaveChangesAsync();

        var result = await _service.GetAchievementHoldersAsync();

        var offside = result.Achievements.Single(a => a.Id == "offside_trap");
        offside.HolderUserIds.Should().BeEquivalentTo(new[] { offsider.Id });

        var icing = result.Achievements.Single(a => a.Id == "icing_machine");
        icing.HolderUserIds.Should().BeEmpty();
    }
}
