using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record PositionColorDto(SeasonUserPosition Position, string? Color);

/// <summary>Position name (LW, C, RW, LD, RD) → colour; null or empty clears it. Positions left out are unchanged.</summary>
public record UpdatePositionColorsDto(Dictionary<string, string?> Colors);

/// <summary>
/// A user's ring colour in one match. Source: "match" (set for this match), "season" (set for the
/// season), "position" (the position's default) or null when there is none.
/// </summary>
public record MatchUserColorDto(int UserId, string Name, SeasonUserPosition? Position, string? Color, string? Source, string? SeasonColor);

public record UpdateColorDto(string? Color);
