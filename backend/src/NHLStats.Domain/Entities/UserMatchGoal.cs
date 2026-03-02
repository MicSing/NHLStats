namespace NHLStats.Domain.Entities;

public class UserMatchGoal
{
    public int Id { get; set; }
    public int UserMatchId { get; set; }
    public int RosterPlayerId { get; set; }
    public int Count { get; set; }

    public UserMatch? UserMatch { get; set; }
    public RosterPlayer? RosterPlayer { get; set; }
}
