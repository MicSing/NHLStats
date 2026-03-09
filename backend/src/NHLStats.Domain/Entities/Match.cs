namespace NHLStats.Domain.Entities;

public class Match
{
    public int Id { get; set; }
    public int SeasonId { get; set; }
    public int MatchNumber { get; set; }
    public int HomeTeamId { get; set; }
    public int AwayTeamId { get; set; }
    public int HomeScore { get; set; }
    public int AwayScore { get; set; }
    public DateTime? MatchDate { get; set; }
    public CompletionType CompletionType { get; set; } = CompletionType.None;

    public Season? Season { get; set; }
    public Team? HomeTeam { get; set; }
    public Team? AwayTeam { get; set; }
    public ICollection<UserMatch>? UserMatches { get; set; }
    public ICollection<Bet>? Bets { get; set; }
}
