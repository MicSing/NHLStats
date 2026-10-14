using System.ComponentModel.DataAnnotations;
namespace NHLStats.Domain.Entities;

public class Season
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = null!;
    public int? HostedTeamId { get; set; }
    public DateTime StartedOn { get; set; }
    public SeasonStatus Status { get; set; } = SeasonStatus.Active;
    public int? ParentSeasonId { get; set; }
    public LeagueType LeagueType { get; set; } = LeagueType.NHL;
    public int? NhlYear { get; set; }
    public GamingConsole? Console { get; set; }

    /// <summary>
    /// Whether players collect plus/minus points in this season. When false, positive and negative
    /// points can't be recorded and the season's matches are closed for betting.
    /// </summary>
    public bool PointsEnabled { get; set; } = true;

    public Team? HostedTeam { get; set; }
    public Season? ParentSeason { get; set; }
    public ICollection<SeasonUser> SeasonUsers { get; set; } = [];
    public ICollection<Match> Matches { get; set; } = [];
    public ICollection<SeasonRosterPlayer> SeasonRosterPlayers { get; set; } = [];
}
