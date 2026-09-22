using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Application.Services;

// Talks to the NHL's public (unofficial) schedule API at api-web.nhle.com to fetch the
// real, planned games for a given season. There is no single "whole league" schedule
// endpoint, so this pulls each team's season schedule and de-duplicates by game id
// (every game shows up once in each participating team's schedule).
public class NhlScheduleClient : INhlScheduleClient
{
    private const int RegularSeasonGameType = 2;

    // Current NHL team abbreviations, as recognized by the schedule API. A team that
    // didn't exist yet for a given season (e.g. UTA before 2024-25) simply returns 404
    // for that season, which is treated as "no games from this team" rather than an error.
    private static readonly string[] TeamAbbreviations =
    [
        "ANA", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL", "DET",
        "EDM", "FLA", "LAK", "MIN", "MTL", "NSH", "NJD", "NYI", "NYR", "OTT",
        "PHI", "PIT", "SJS", "SEA", "STL", "TBL", "TOR", "UTA", "VAN", "VGK",
        "WSH", "WPG"
    ];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _httpClient;

    public NhlScheduleClient(HttpClient httpClient) => _httpClient = httpClient;

    public async Task<IReadOnlyList<NhlGameDto>> GetRegularSeasonGamesAsync(int nhlYear, CancellationToken cancellationToken = default)
    {
        var seasonCode = NhlSeasonCodeHelper.GetSeasonCode(nhlYear);
        var gamesById = new Dictionary<long, NhlGameDto>();

        foreach (var abbrev in TeamAbbreviations)
        {
            NhlClubScheduleSeasonResponse? response;
            try
            {
                response = await _httpClient.GetFromJsonAsync<NhlClubScheduleSeasonResponse>(
                    $"v1/club-schedule-season/{abbrev}/{seasonCode}", JsonOptions, cancellationToken);
            }
            catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                continue;
            }

            if (response?.Games == null) continue;

            foreach (var game in response.Games)
            {
                if (game.GameType != RegularSeasonGameType) continue;
                if (string.IsNullOrWhiteSpace(game.HomeTeam?.Abbrev) || string.IsNullOrWhiteSpace(game.AwayTeam?.Abbrev)) continue;

                var gameDate = ParseGameDateUtc(game);
                if (gameDate == null) continue;

                gamesById[game.Id] = new NhlGameDto(game.Id, game.HomeTeam.Abbrev, game.AwayTeam.Abbrev, gameDate.Value);
            }
        }

        return gamesById.Values.OrderBy(g => g.GameDateUtc).ToList();
    }

    private static DateTime? ParseGameDateUtc(NhlApiGame game)
    {
        if (DateTime.TryParse(game.StartTimeUTC, out var startTimeUtc))
            return DateTime.SpecifyKind(startTimeUtc, DateTimeKind.Utc);

        if (DateTime.TryParse(game.GameDate, out var gameDate))
            return DateTime.SpecifyKind(gameDate, DateTimeKind.Utc);

        return null;
    }

    private sealed class NhlClubScheduleSeasonResponse
    {
        public List<NhlApiGame> Games { get; set; } = [];
    }

    private sealed class NhlApiGame
    {
        public long Id { get; set; }
        public int GameType { get; set; }
        public string? GameDate { get; set; }
        public string? StartTimeUTC { get; set; }
        public NhlApiTeam? HomeTeam { get; set; }
        public NhlApiTeam? AwayTeam { get; set; }
    }

    private sealed class NhlApiTeam
    {
        public string? Abbrev { get; set; }
    }
}
