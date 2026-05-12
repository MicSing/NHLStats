using Microsoft.AspNetCore.SignalR;
using NHLStats.Api.Hubs;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Services;

public class SignalRSeasonEventBroadcaster : ISeasonEventBroadcaster
{
    private readonly IHubContext<SeasonEventsHub> _hub;

    public SignalRSeasonEventBroadcaster(IHubContext<SeasonEventsHub> hub) => _hub = hub;

    public Task BroadcastEventAsync(SeasonEventNotificationDto evt, CancellationToken ct = default)
        => _hub.Clients
            .Group(SeasonEventsHub.GroupName(evt.SeasonId))
            .SendAsync("SeasonEvent", evt, ct);
}
