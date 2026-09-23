using System.Text.Json.Serialization;

namespace NHLStats.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum CompletionType
{
    None = 0,
    RegularTime = 1,
    Overtime = 2,
    Shootout = 3,
    InProgress = 4
}
