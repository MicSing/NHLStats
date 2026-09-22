using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface INhlScheduleClient
{
    Task<IReadOnlyList<NhlGameDto>> GetRegularSeasonGamesAsync(int nhlYear, CancellationToken cancellationToken = default);
}
