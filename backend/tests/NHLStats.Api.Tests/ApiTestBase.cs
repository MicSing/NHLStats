using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace NHLStats.Api.Tests;

/// <summary>
/// Base class for Phase 4 integration tests.
/// Provides helpers to obtain an authenticated HttpClient.
/// </summary>
public abstract class ApiTestBase : IClassFixture<CustomWebApplicationFactory>
{
    protected const string AdminEmail = "testadmin@nhlstats.test";
    protected const string AdminPassword = "TestP@ssw0rd!";

    protected readonly CustomWebApplicationFactory Factory;

    protected ApiTestBase(CustomWebApplicationFactory factory)
    {
        Factory = factory;
    }

    protected async Task<HttpClient> CreateAuthenticatedClientAsync()
    {
        var client = Factory.CreateClient();
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = AdminEmail,
            password = AdminPassword
        });
        loginResp.EnsureSuccessStatusCode();

        var body = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString()!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>
    /// Ensures the admin has a linked User entity, adds them to the season, and seeds positive points
    /// so they have a non-zero betting balance. Safe to call multiple times.
    /// </summary>
    protected async Task<int> SeedBettingBalanceAsync(HttpClient client, int seasonId)
    {
        var meResp = await client.GetAsync("/api/auth/me");
        meResp.EnsureSuccessStatusCode();
        var me = await meResp.Content.ReadFromJsonAsync<JsonElement>();
        var loginId = me.GetProperty("id").GetString()!;

        int userId;
        if (me.TryGetProperty("userId", out var userIdProp) && userIdProp.ValueKind != JsonValueKind.Null)
        {
            userId = userIdProp.GetInt32();
        }
        else
        {
            var createUserResp = await client.PostAsJsonAsync("/api/users", new { name = "Test Admin User" });
            createUserResp.EnsureSuccessStatusCode();
            var createdUser = await createUserResp.Content.ReadFromJsonAsync<JsonElement>();
            userId = createdUser.GetProperty("id").GetInt32();

            var attachResp = await client.PutAsJsonAsync($"/api/auth/users/{loginId}/attach-user", new { userId });
            attachResp.EnsureSuccessStatusCode();
        }

        // Add user to season (ignore conflict)
        var addUserResp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        if (!addUserResp.IsSuccessStatusCode && addUserResp.StatusCode != System.Net.HttpStatusCode.Conflict)
            addUserResp.EnsureSuccessStatusCode();

        // Create a completed match to seed positive points
        var completedMatchResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId = 5, awayTeamId = 6 });
        completedMatchResp.EnsureSuccessStatusCode();
        var completedMatch = await completedMatchResp.Content.ReadFromJsonAsync<JsonElement>();
        var completedMatchId = completedMatch.GetProperty("id").GetInt32();

        var completeResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}", new
        {
            homeTeamId = 5,
            awayTeamId = 6,
            homeScore = 2,
            awayScore = 1,
            matchDate = DateTime.UtcNow.AddDays(-1).ToString("O"),
            completionType = 1
        });
        completeResp.EnsureSuccessStatusCode();

        await client.PostAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches/initialize", null);

        var umResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches");
        if (umResp.IsSuccessStatusCode)
        {
            var ums = await umResp.Content.ReadFromJsonAsync<JsonElement>();
            if (ums.GetArrayLength() > 0)
            {
                var userMatchId = ums[0].GetProperty("id").GetInt32();
                var pointResp = await client.PostAsJsonAsync($"/api/usermatches/{userMatchId}/points",
                    new { pointReasonId = 9, count = 4 });
                pointResp.EnsureSuccessStatusCode();
            }
        }

        return userId;
    }
}
