using System.Text.Json.Serialization;

namespace NHLStats.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum MatchPhase
{
    RegularSeason = 0,
    Playoff = 1
}
