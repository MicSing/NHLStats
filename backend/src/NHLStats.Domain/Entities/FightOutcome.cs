using System.Text.Json.Serialization;

namespace NHLStats.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum FightOutcome
{
    Won = 0,
    Lost = 1,
    Draw = 2
}
