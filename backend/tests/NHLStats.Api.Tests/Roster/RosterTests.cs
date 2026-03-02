using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class RosterTests : ApiTestBase
{
    public RosterTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<int> CreateSeasonAsync(HttpClient client, string name = "Roster Test Season")
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name,
            startedOn = "2024-01-01T00:00:00"
        });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetInt32();
    }

    // ── GET /api/seasons/{seasonId}/roster ──────────────────────────────────

    [Fact]
    public async Task GetBySeason_returns_200_and_empty_array_for_new_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "GetRoster Season");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/roster");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task GetBySeason_returns_only_that_seasons_players()
    {
        var client = await CreateAuthenticatedClientAsync();
        var season1 = await CreateSeasonAsync(client, "Season Isolation A");
        var season2 = await CreateSeasonAsync(client, "Season Isolation B");

        // Add player to season1
        await client.PostAsJsonAsync($"/api/seasons/{season1}/roster", new
        {
            firstName = "Alex",
            surname = "Ovechkin",
            position = "LW",
            teamId = 1
        });

        // Season2 should still be empty
        var resp = await client.GetAsync($"/api/seasons/{season2}/roster");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(0);

        // Season1 should have the player
        var resp1 = await client.GetAsync($"/api/seasons/{season1}/roster");
        var body1 = await resp1.Content.ReadFromJsonAsync<JsonElement>();
        body1.GetArrayLength().Should().Be(1);
    }

    // ── POST /api/seasons/{seasonId}/roster ─────────────────────────────────

    [Fact]
    public async Task Create_player_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/seasons/1/roster", new
        {
            firstName = "Test",
            surname = "Player",
            teamId = 1
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_player_returns_201_linked_to_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Create Player Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new
        {
            firstName = "Connor",
            surname = "McDavid",
            position = "C",
            teamId = 1
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("firstName").GetString().Should().Be("Connor");
        body.GetProperty("surname").GetString().Should().Be("McDavid");
        body.GetProperty("position").GetString().Should().Be("C");
        body.GetProperty("seasonId").GetInt32().Should().Be(seasonId);
        body.GetProperty("teamId").GetInt32().Should().Be(1);
        body.GetProperty("isActive").GetBoolean().Should().BeTrue();
        body.GetProperty("id").GetInt32().Should().BePositive();
    }

    [Fact]
    public async Task Create_player_missing_required_fields_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Validation Season");

        // Missing firstName
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new
        {
            surname = "Gretzky",
            teamId = 1
        });
        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── PUT /api/seasons/{seasonId}/roster/{id} ─────────────────────────────

    [Fact]
    public async Task Update_player_returns_200_with_updated_data()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Update Player Season");

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new
        {
            firstName = "Wayne",
            surname = "Gretzky",
            position = "C",
            teamId = 1
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var playerId = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/roster/{playerId}", new
        {
            firstName = "Wayne",
            surname = "Gretzky",
            position = "RW",
            teamId = 2,
            isActive = false
        });

        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("position").GetString().Should().Be("RW");
        updated.GetProperty("teamId").GetInt32().Should().Be(2);
        updated.GetProperty("isActive").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Update_player_from_wrong_season_returns_404()
    {
        var client = await CreateAuthenticatedClientAsync();
        var season1 = await CreateSeasonAsync(client, "Update Season1");
        var season2 = await CreateSeasonAsync(client, "Update Season2");

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{season1}/roster", new
        {
            firstName = "Mario",
            surname = "Lemieux",
            position = "C",
            teamId = 1
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var playerId = created.GetProperty("id").GetInt32();

        // Try to update via the wrong season
        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{season2}/roster/{playerId}", new
        {
            firstName = "Mario",
            surname = "Lemieux",
            position = "LW",
            teamId = 1,
            isActive = true
        });
        updateResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── DELETE /api/seasons/{seasonId}/roster/{id} ──────────────────────────

    [Fact]
    public async Task Delete_player_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Delete Player Season");

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new
        {
            firstName = "Sidney",
            surname = "Crosby",
            position = "C",
            teamId = 1
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var playerId = created.GetProperty("id").GetInt32();

        var deleteResp = await client.DeleteAsync($"/api/seasons/{seasonId}/roster/{playerId}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/seasons/{seasonId}/roster/{playerId}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── POST /api/seasons/{seasonId}/roster/import ──────────────────────────

    [Fact]
    public async Task ImportCsv_returns_200_with_imported_count()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "CSV Import Season");

        // Get a valid team short name from the seeded teams
        var teamsResp = await client.GetAsync("/api/teams");
        var teams = await teamsResp.Content.ReadFromJsonAsync<JsonElement>();
        var shortName = teams[0].GetProperty("shortName").GetString()!;

        var csv = $"FirstName,Surname,Position,TeamShortName\nJohn,Doe,C,{shortName}\nJane,Smith,LW,{shortName}";

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster/import",
            new { csvContent = csv });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("imported").GetInt32().Should().Be(2);
        body.GetProperty("errors").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task ImportCsv_with_invalid_team_short_name_returns_error_in_result()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "CSV Invalid Team Season");

        var csv = "FirstName,Surname,Position,TeamShortName\nBob,Jones,D,INVALID_TEAM_XYZ";

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster/import",
            new { csvContent = csv });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("imported").GetInt32().Should().Be(0);
        body.GetProperty("errors").GetArrayLength().Should().Be(1);
        body.GetProperty("errors")[0].GetString().Should().Contain("INVALID_TEAM_XYZ");
    }

    [Fact]
    public async Task ImportCsv_partial_success_counts_valid_rows_and_reports_errors()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "CSV Partial Season");

        var teamsResp = await client.GetAsync("/api/teams");
        var teams = await teamsResp.Content.ReadFromJsonAsync<JsonElement>();
        var shortName = teams[0].GetProperty("shortName").GetString()!;

        var csv = $"GoodPlayer,One,RW,{shortName}\nBadPlayer,Two,LW,NOPE";

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster/import",
            new { csvContent = csv });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("imported").GetInt32().Should().Be(1);
        body.GetProperty("errors").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task ImportCsv_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/seasons/1/roster/import",
            new { csvContent = "a,b,c,d" });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── POST /api/seasons/{seasonId}/roster/copy/{sourceSeasonId} ───────────

    [Fact]
    public async Task CopyFromSeason_copies_all_players_to_target_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var sourceSeason = await CreateSeasonAsync(client, "Copy Source Season");
        var targetSeason = await CreateSeasonAsync(client, "Copy Target Season");

        // Add two players to source
        await client.PostAsJsonAsync($"/api/seasons/{sourceSeason}/roster", new
        {
            firstName = "Player",
            surname = "One",
            position = "C",
            teamId = 1
        });
        await client.PostAsJsonAsync($"/api/seasons/{sourceSeason}/roster", new
        {
            firstName = "Player",
            surname = "Two",
            position = "D",
            teamId = 2
        });

        var copyResp = await client.PostAsync(
            $"/api/seasons/{targetSeason}/roster/copy/{sourceSeason}", null);

        copyResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await copyResp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(2);

        // Verify target season now has 2 players
        var getRespTarget = await client.GetAsync($"/api/seasons/{targetSeason}/roster");
        var targetRoster = await getRespTarget.Content.ReadFromJsonAsync<JsonElement>();
        targetRoster.GetArrayLength().Should().Be(2);

        // Source season still has its original players
        var getRespSource = await client.GetAsync($"/api/seasons/{sourceSeason}/roster");
        var sourceRoster = await getRespSource.Content.ReadFromJsonAsync<JsonElement>();
        sourceRoster.GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task CopyFromSeason_nonexistent_source_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var targetSeason = await CreateSeasonAsync(client, "Copy Bad Source Season");

        var resp = await client.PostAsync(
            $"/api/seasons/{targetSeason}/roster/copy/99999", null);

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CopyFromSeason_empty_source_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var sourceSeason = await CreateSeasonAsync(client, "Empty Source Season");
        var targetSeason = await CreateSeasonAsync(client, "Target of Empty Source");

        var resp = await client.PostAsync(
            $"/api/seasons/{targetSeason}/roster/copy/{sourceSeason}", null);

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CopyFromSeason_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsync("/api/seasons/2/roster/copy/1", null);
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
