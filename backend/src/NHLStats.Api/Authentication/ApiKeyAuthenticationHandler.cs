using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Authentication;

/// <summary>
/// Authenticates machine clients (the Collector) by the <c>X-Api-Key</c> header.
/// A valid key yields a principal in the <see cref="CollectorRole"/> role and nothing else,
/// so API keys can only reach endpoints that explicitly opt into this scheme.
/// </summary>
public class ApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "ApiKey";
    public const string HeaderName = "X-Api-Key";
    public const string CollectorRole = "Collector";
    public const string ApiKeyIdClaim = "api_key_id";

    private readonly IApiKeyService _apiKeys;

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IApiKeyService apiKeys)
        : base(options, logger, encoder)
    {
        _apiKeys = apiKeys;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var values))
            return AuthenticateResult.NoResult();

        var provided = values.ToString();
        if (string.IsNullOrWhiteSpace(provided))
            return AuthenticateResult.Fail("Empty API key.");

        var key = await _apiKeys.ValidateAsync(provided);
        if (key == null)
            return AuthenticateResult.Fail("Invalid or revoked API key.");

        var identity = new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, $"apikey:{key.Id}"),
            new Claim(ClaimTypes.Name, key.Name),
            new Claim(ClaimTypes.Role, CollectorRole),
            new Claim(ApiKeyIdClaim, key.Id.ToString())
        ], SchemeName);

        return AuthenticateResult.Success(
            new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }
}
