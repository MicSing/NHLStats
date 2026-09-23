using System.Text.Json.Serialization;

namespace NHLStats.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum GoalType
{
    Regular = 0,
    PowerPlay = 1,
    ShortHanded = 2,
    Shootout = 3
}
