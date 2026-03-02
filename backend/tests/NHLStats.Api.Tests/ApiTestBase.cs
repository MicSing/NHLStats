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
}
