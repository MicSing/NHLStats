using System.Text.Json.Serialization;

namespace NHLStats.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MatchEventType
{
    Goal = 1,
    Penalty = 2,
    Point = 3,
    PeriodChange = 4,
    MatchEnd = 5,
    ShootoutGoal = 6
}
