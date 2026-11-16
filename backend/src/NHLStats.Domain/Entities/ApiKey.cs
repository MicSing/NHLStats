namespace NHLStats.Domain.Entities;

/// <summary>
/// A machine credential for an external client (e.g. the Collector app) that calls the
/// ingest API with the <c>X-Api-Key</c> header. Only a SHA-256 hash of the key is stored;
/// the plaintext is shown to the admin once, at creation.
/// </summary>
public class ApiKey
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    /// <summary>First characters of the plaintext key, so an admin can tell keys apart.</summary>
    public string Prefix { get; set; } = null!;
    /// <summary>Lowercase hex SHA-256 of the plaintext key.</summary>
    public string KeyHash { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}
