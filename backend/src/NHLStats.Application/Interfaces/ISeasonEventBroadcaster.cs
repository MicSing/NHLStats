using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface ISeasonEventBroadcaster
{
    Task BroadcastEventAsync(SeasonEventNotificationDto evt, CancellationToken ct = default);
}
