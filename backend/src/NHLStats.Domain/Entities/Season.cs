using System.ComponentModel.DataAnnotations;
namespace NHLStats.Domain.Entities;

public class Season
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = null!;
    public int? HostedTeamId { get; set; }
    public DateTime StartedOn { get; set; }
    public string? Status { get; set; }
    public int? ParentSeasonId { get; set; }

    public Team? HostedTeam { get; set; }
    public Season? ParentSeason { get; set; }
    public ICollection<SeasonUser>? SeasonUsers { get; set; }
    public ICollection<Match>? Matches { get; set; }
    public ICollection<RosterPlayer>? RosterPlayers { get; set; }
}
