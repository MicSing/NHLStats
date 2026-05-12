using System.Security.Claims;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Services;

public class HttpContextCurrentActorProvider : ICurrentActorProvider
{
    private readonly IHttpContextAccessor _accessor;

    public HttpContextCurrentActorProvider(IHttpContextAccessor accessor) => _accessor = accessor;

    public string? ActorUserId =>
        _accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);

    public string? ActorUserName =>
        _accessor.HttpContext?.User.FindFirstValue(ClaimTypes.Email)
        ?? _accessor.HttpContext?.User.Identity?.Name;
}
