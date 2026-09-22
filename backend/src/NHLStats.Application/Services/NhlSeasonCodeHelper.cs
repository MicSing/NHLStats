namespace NHLStats.Application.Services;

// Maps the video game's "NHL <year>" naming (e.g. NHL 26) onto the real NHL season it
// depicts (e.g. the 2025-26 season) and onto the season code the NHL's public schedule
// API expects (e.g. "20252026").
public static class NhlSeasonCodeHelper
{
    private const int FirstStartYearOffset = 1999;

    public static int GetSeasonStartYear(int nhlYear)
    {
        if (nhlYear is < 1 or > 99)
            throw new ArgumentOutOfRangeException(nameof(nhlYear),
                "NHL year must be between 1 and 99, e.g. 26 for NHL 26 (the 2025-26 season).");

        return FirstStartYearOffset + nhlYear;
    }

    public static string GetSeasonCode(int nhlYear)
    {
        var startYear = GetSeasonStartYear(nhlYear);
        return $"{startYear}{startYear + 1}";
    }
}
