using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record PositionColorDto(SeasonUserPosition Position, string? Color);

/// <summary>Position name (LW, C, RW, LD, RD) → colour; null or empty clears it. Positions left out are unchanged.</summary>
public record UpdatePositionColorsDto(Dictionary<string, string?> Colors);
