using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IMatchEventService
{
    Task<IEnumerable<MatchEventDto>> GetEventsByMatchAsync(int matchId);
    Task<(MatchEventDto? result, string? error)> AddEventAsync(int matchId, CreateTeamMatchEventDto dto);
    Task<(bool success, string? error)> ReorderEventsAsync(int matchId, List<int> eventIds);
    Task<bool> DeleteEventAsync(int matchId, int eventId);
    Task<(MatchDto? match, string? error)> EndShootoutAsync(int matchId);
}
