using System.Text.Json.Serialization;

namespace NHLStats.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ProposalConfidence
{
    Low = 0,
    Medium = 1,
    High = 2
}
