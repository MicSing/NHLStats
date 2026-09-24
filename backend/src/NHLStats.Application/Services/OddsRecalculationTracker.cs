using System.Collections.Concurrent;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Application.Services;

/// <summary>
/// In-memory, process-wide tracker (registered as a singleton). Finished entries are kept for
/// <see cref="Retention"/> so the admin UI can show the outcome, then dropped.
/// </summary>
public class OddsRecalculationTracker : IOddsRecalculationTracker
{
    public static readonly TimeSpan Retention = TimeSpan.FromMinutes(10);

    private enum JobState { Pending, Running, Done, Failed }

    private sealed record Entry(int SeasonId, JobState State, DateTime QueuedAt, DateTime UpdatedAt, string? Error);

    private readonly ConcurrentDictionary<int, Entry> _entries = new();
    private readonly TimeProvider _time;

    public OddsRecalculationTracker() : this(TimeProvider.System) { }

    public OddsRecalculationTracker(TimeProvider time)
    {
        _time = time;
    }

    private DateTime Now => _time.GetUtcNow().UtcDateTime;

    public void MarkQueued(int seasonId, IEnumerable<int> matchIds)
    {
        var now = Now;
        foreach (var id in matchIds)
            _entries[id] = new Entry(seasonId, JobState.Pending, now, now, null);
    }

    public void MarkRunning(int matchId) => Transition(matchId, JobState.Running, null);

    public void MarkDone(int matchId) => Transition(matchId, JobState.Done, null);

    public void MarkFailed(int matchId, string error) => Transition(matchId, JobState.Failed, error);

    private void Transition(int matchId, JobState state, string? error)
    {
        var now = Now;
        _entries.AddOrUpdate(
            matchId,
            _ => new Entry(0, state, now, now, error),
            (_, e) => e with { State = state, UpdatedAt = now, Error = error });
    }

    public OddsRecalculationStatusDto GetSeasonStatus(int seasonId)
    {
        PruneExpired();

        var entries = _entries
            .Where(kv => kv.Value.SeasonId == seasonId)
            .OrderBy(kv => kv.Key)
            .ToList();

        var pending = entries
            .Where(kv => kv.Value.State is JobState.Pending or JobState.Running)
            .Select(kv => kv.Key)
            .ToList();
        var completed = entries
            .Where(kv => kv.Value.State == JobState.Done)
            .Select(kv => kv.Key)
            .ToList();
        var failed = entries.Where(kv => kv.Value.State == JobState.Failed).ToList();

        return new OddsRecalculationStatusDto(
            InProgress: pending.Count > 0,
            Pending: pending.Count,
            Completed: completed.Count,
            Failed: failed.Count,
            PendingMatchIds: pending,
            CompletedMatchIds: completed,
            StartedAt: entries.Count == 0 ? null : entries.Min(kv => kv.Value.QueuedAt),
            LastError: failed.OrderByDescending(kv => kv.Value.UpdatedAt).Select(kv => kv.Value.Error).FirstOrDefault());
    }

    private void PruneExpired()
    {
        var cutoff = Now - Retention;
        foreach (var (id, entry) in _entries)
        {
            if (entry.State is JobState.Done or JobState.Failed && entry.UpdatedAt < cutoff)
                _entries.TryRemove(id, out _);
        }
    }
}
