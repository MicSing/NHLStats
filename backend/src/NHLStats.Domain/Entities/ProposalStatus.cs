using System.Text.Json.Serialization;

namespace NHLStats.Domain.Entities;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ProposalStatus
{
    Proposed = 0,
    Confirmed = 1,
    Rejected = 2
}
