using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface IPositionColorService
{
    Task<IReadOnlyList<PositionColorDto>> GetAllAsync();
    Task<Dictionary<SeasonUserPosition, string>> GetMapAsync();
    Task<(IReadOnlyList<PositionColorDto>? colors, string? error)> UpdateAsync(UpdatePositionColorsDto dto);
}
