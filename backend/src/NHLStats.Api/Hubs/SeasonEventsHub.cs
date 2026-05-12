using Microsoft.AspNetCore.SignalR;

namespace NHLStats.Api.Hubs;

public class SeasonEventsHub : Hub
{
    public Task JoinSeason(int seasonId)
        => Groups.AddToGroupAsync(Context.ConnectionId, GroupName(seasonId));

    public Task LeaveSeason(int seasonId)
        => Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(seasonId));

    public static string GroupName(int seasonId) => $"season-{seasonId}";
}
