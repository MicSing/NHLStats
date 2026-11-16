using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface IPositionColorService
{
    Task<IReadOnlyList<PositionColorDto>> GetAllAsync();
    Task<Dictionary<SeasonUserPosition, string>> GetMapAsync();
    Task<(IReadOnlyList<PositionColorDto>? colors, string? error)> UpdateAsync(UpdatePositionColorsDto dto);

    /// <summary>Colours of the users in a match (match → season → position); null if the match doesn't exist.</summary>
    Task<IReadOnlyList<MatchUserColorDto>?> GetMatchColorsAsync(int matchId);

    /// <summary>Sets or clears a user's colour for one match. (null, null) when the user isn't in the match.</summary>
    Task<(IReadOnlyList<MatchUserColorDto>? colors, string? error)> SetMatchColorAsync(int matchId, int userId, string? color);
}
