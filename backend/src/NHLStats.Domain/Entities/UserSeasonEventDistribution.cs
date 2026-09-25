namespace NHLStats.Domain.Entities;

/// <summary>
/// Cached per-season history used by the betting odds: for one user, season and user-event
/// market, how many completed matches had exactly <see cref="Occurrences"/> events.
/// Built on first use and dropped by <see cref="NhlStatsDbContext"/> whenever the underlying
/// user-match stats of that season change, so reading it never needs the raw match data.
/// </summary>
public class UserSeasonEventDistribution
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int SeasonId { get; set; }
    public OddsBetType BetType { get; set; }
    public int Occurrences { get; set; }
    public int MatchCount { get; set; }

    public Season? Season { get; set; }
}
