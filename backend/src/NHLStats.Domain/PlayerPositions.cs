using NHLStats.Domain.Entities;

namespace NHLStats.Domain;

/// <summary>
/// A roster player can hold multiple positions (e.g. "C, RW"). Position is stored as a
/// comma-separated string of <see cref="PlayerPosition"/> codes, always normalized to
/// <see cref="CanonicalOrder"/> so the same set of positions always renders identically.
/// </summary>
public static class PlayerPositions
{
    public static readonly IReadOnlyList<PlayerPosition> CanonicalOrder =
    [
        PlayerPosition.C, PlayerPosition.LW, PlayerPosition.RW, PlayerPosition.D, PlayerPosition.G
    ];

    public static readonly IReadOnlyList<string> Codes =
        CanonicalOrder.Select(p => p.ToString()).ToList();

    // Keep in sync with Codes above — DataAnnotations attributes require a compile-time constant.
    public const string ValidationPattern = @"^(C|LW|RW|D|G)(\s*,\s*(C|LW|RW|D|G))*$";

    private static readonly Dictionary<string, PlayerPosition> ByCode =
        CanonicalOrder.ToDictionary(p => p.ToString(), p => p, StringComparer.OrdinalIgnoreCase);

    public static bool TryParse(string? raw, out IReadOnlyList<PlayerPosition> positions)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            positions = [];
            return true;
        }

        var tokens = raw.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        var parsed = new HashSet<PlayerPosition>();
        foreach (var token in tokens)
        {
            if (!ByCode.TryGetValue(token, out var position))
            {
                positions = [];
                return false;
            }
            parsed.Add(position);
        }

        positions = CanonicalOrder.Where(parsed.Contains).ToList();
        return true;
    }

    public static string? Format(IEnumerable<PlayerPosition> positions)
    {
        var set = positions.ToHashSet();
        var ordered = CanonicalOrder.Where(set.Contains).Select(p => p.ToString()).ToList();
        return ordered.Count == 0 ? null : string.Join(", ", ordered);
    }

    /// <summary>Reorders/reformats a raw position string into canonical form. Returns null for null/blank input.</summary>
    /// <exception cref="FormatException">Thrown when <paramref name="raw"/> contains a token that isn't a known position code.</exception>
    public static string? Normalize(string? raw)
    {
        if (!TryParse(raw, out var positions))
            throw new FormatException($"Invalid position value '{raw}'. Allowed codes: {string.Join(", ", Codes)}.");
        return Format(positions);
    }

    public static bool Contains(string? raw, PlayerPosition position) =>
        TryParse(raw, out var positions) && positions.Contains(position);

    public static bool ContainsAny(string? raw, IReadOnlyCollection<PlayerPosition> candidates) =>
        TryParse(raw, out var positions) && positions.Any(candidates.Contains);
}
