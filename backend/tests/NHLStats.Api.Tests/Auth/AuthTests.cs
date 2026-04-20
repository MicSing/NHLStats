using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.IdentityModel.Tokens;

namespace NHLStats.Api.Tests;

/// <summary>
/// Phase 3 integration tests: authentication via ASP.NET Identity + JWT.
/// Each test creates its own HttpClient so that DefaultRequestHeaders
/// mutations in one test never bleed into another.
/// The factory (and therefore the in-memory SQLite DB) is shared across the
/// class via IClassFixture — the seeded admin user is always present.
/// </summary>
public class AuthTests : IClassFixture<CustomWebApplicationFactory>
{
    private const string AdminEmail = "testadmin@nhlstats.test";
    private const string AdminPassword = "TestP@ssw0rd!";

    private readonly CustomWebApplicationFactory _factory;

    public AuthTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // -----------------------------------------------------------------------
    // Register
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Register_returns_201_and_creates_user()
    {
        var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = "brand-new@test.com",
            password = "Passw0rd!"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Register_with_duplicate_email_returns_409()
    {
        var client = _factory.CreateClient();
        var dto = new { email = "duplicate@test.com", password = "Passw0rd!" };

        await client.PostAsJsonAsync("/api/auth/register", dto);
        var second = await client.PostAsJsonAsync("/api/auth/register", dto);

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // -----------------------------------------------------------------------
    // Login
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Login_with_valid_credentials_returns_jwt()
    {
        var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = AdminEmail,
            password = AdminPassword
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("token").GetString()
            .Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Login_with_invalid_credentials_returns_401()
    {
        var client = _factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = AdminEmail,
            password = "completely-wrong"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // -----------------------------------------------------------------------
    // Protected endpoint (/api/auth/me)
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Protected_endpoint_without_token_returns_401()
    {
        var client = _factory.CreateClient();

        var resp = await client.GetAsync("/api/auth/me");

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Protected_endpoint_with_valid_token_returns_200_and_user_info()
    {
        var client = _factory.CreateClient();

        // Step 1: obtain token
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = AdminEmail,
            password = AdminPassword
        });
        loginResp.EnsureSuccessStatusCode();

        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var token = loginBody.GetProperty("token").GetString()!;

        // Step 2: call protected endpoint with the token
        var authedClient = _factory.CreateClient();
        authedClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var meResp = await authedClient.GetAsync("/api/auth/me");

        meResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var me = await meResp.Content.ReadFromJsonAsync<JsonElement>();
        me.GetProperty("email").GetString()
            .Should().Be(AdminEmail);
    }

    // -----------------------------------------------------------------------
    // Refresh
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Refresh_with_valid_token_returns_200_and_new_token()
    {
        var client = _factory.CreateClient();

        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = AdminEmail,
            password = AdminPassword
        });
        loginResp.EnsureSuccessStatusCode();
        var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var token = loginBody.GetProperty("token").GetString()!;

        var refreshClient = _factory.CreateClient();
        refreshClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var resp = await refreshClient.PostAsync("/api/auth/refresh", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("token").GetString()
            .Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Refresh_without_token_returns_401()
    {
        var client = _factory.CreateClient();

        var resp = await client.PostAsync("/api/auth/refresh", null);

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_accepts_recently_expired_token_that_default_scheme_rejects()
    {
        // Log in to get a real user ID for claim construction
        var client = _factory.CreateClient();
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = AdminEmail,
            password = AdminPassword
        });
        loginResp.EnsureSuccessStatusCode();
        var validToken = (await loginResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("token").GetString()!;

        var handler = new JwtSecurityTokenHandler();
        var parsed = handler.ReadJwtToken(validToken);
        var userId = parsed.Claims.First(c => c.Type == ClaimTypes.NameIdentifier).Value;
        var userEmail = parsed.Claims.First(c => c.Type == ClaimTypes.Email).Value;

        // Build a token that expired 3 minutes ago — within RefreshBearer's 5-min ClockSkew
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("REPLACE_WITH_SECURE_VALUE_IN_PRODUCTION"));
        var expiredToken = handler.WriteToken(new JwtSecurityToken(
            issuer: "NHLStats",
            audience: "NHLStatsClient",
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId),
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Email, userEmail),
            },
            expires: DateTime.UtcNow.AddMinutes(-3),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        ));

        // Default scheme (ClockSkew=0) should reject it
        var meClient = _factory.CreateClient();
        meClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", expiredToken);
        var meResp = await meClient.GetAsync("/api/auth/me");
        meResp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // RefreshBearer (ClockSkew=5min) should accept it and return a new token
        var refreshClient = _factory.CreateClient();
        refreshClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", expiredToken);
        var refreshResp = await refreshClient.PostAsync("/api/auth/refresh", null);
        refreshResp.StatusCode.Should().Be(HttpStatusCode.OK);
        (await refreshResp.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("token").GetString()
            .Should().NotBeNullOrWhiteSpace();
    }
}
