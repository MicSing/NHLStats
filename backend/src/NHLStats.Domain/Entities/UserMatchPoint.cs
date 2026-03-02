namespace NHLStats.Domain.Entities;

public class UserMatchPoint
{
    public int Id { get; set; }
    public int UserMatchId { get; set; }
    public int PointReasonId { get; set; }
    public int Count { get; set; }

    public UserMatch? UserMatch { get; set; }
    public PointReason? PointReason { get; set; }
}
