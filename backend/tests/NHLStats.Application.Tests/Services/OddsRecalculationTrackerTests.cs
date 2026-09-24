using FluentAssertions;
using NHLStats.Application.Services;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class OddsRecalculationTrackerTests
{
    private sealed class ManualTimeProvider : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private readonly ManualTimeProvider _time = new();
    private readonly OddsRecalculationTracker _tracker;

    public OddsRecalculationTrackerTests()
    {
        _tracker = new OddsRecalculationTracker(_time);
    }

    [Fact]
    public void Unknown_season_reports_nothing_in_progress()
    {
        var status = _tracker.GetSeasonStatus(1);

        status.InProgress.Should().BeFalse();
        status.Pending.Should().Be(0);
        status.Completed.Should().Be(0);
        status.Failed.Should().Be(0);
        status.StartedAt.Should().BeNull();
    }

    [Fact]
    public void Queued_matches_are_in_progress_until_all_are_done()
    {
        _tracker.MarkQueued(1, [10, 11]);

        var queued = _tracker.GetSeasonStatus(1);
        queued.InProgress.Should().BeTrue();
        queued.Pending.Should().Be(2);
        queued.PendingMatchIds.Should().BeEquivalentTo([10, 11]);
        queued.StartedAt.Should().Be(_time.Now.UtcDateTime);

        _tracker.MarkRunning(10);
        _tracker.MarkDone(10);
        var halfway = _tracker.GetSeasonStatus(1);
        halfway.InProgress.Should().BeTrue();
        halfway.Pending.Should().Be(1);
        halfway.Completed.Should().Be(1);
        halfway.CompletedMatchIds.Should().BeEquivalentTo([10]);

        _tracker.MarkRunning(11);
        _tracker.MarkDone(11);
        var done = _tracker.GetSeasonStatus(1);
        done.InProgress.Should().BeFalse();
        done.Pending.Should().Be(0);
        done.Completed.Should().Be(2);
    }

    [Fact]
    public void Failed_match_is_counted_with_its_error()
    {
        _tracker.MarkQueued(1, [10]);
        _tracker.MarkRunning(10);
        _tracker.MarkFailed(10, "boom");

        var status = _tracker.GetSeasonStatus(1);
        status.InProgress.Should().BeFalse();
        status.Failed.Should().Be(1);
        status.LastError.Should().Be("boom");
    }

    [Fact]
    public void Status_is_scoped_to_the_season()
    {
        _tracker.MarkQueued(1, [10]);
        _tracker.MarkQueued(2, [20, 21]);

        _tracker.GetSeasonStatus(1).Pending.Should().Be(1);
        _tracker.GetSeasonStatus(2).Pending.Should().Be(2);
    }

    [Fact]
    public void Finished_entries_expire_after_the_retention_period_but_pending_ones_do_not()
    {
        _tracker.MarkQueued(1, [10, 11]);
        _tracker.MarkDone(10);

        _time.Now = _time.Now.Add(OddsRecalculationTracker.Retention + TimeSpan.FromSeconds(1));

        var status = _tracker.GetSeasonStatus(1);
        status.Completed.Should().Be(0);
        status.Pending.Should().Be(1);
        status.InProgress.Should().BeTrue();
    }

    [Fact]
    public void Requeueing_a_finished_match_puts_it_back_in_progress()
    {
        _tracker.MarkQueued(1, [10]);
        _tracker.MarkDone(10);

        _tracker.MarkQueued(1, [10]);

        var status = _tracker.GetSeasonStatus(1);
        status.InProgress.Should().BeTrue();
        status.Completed.Should().Be(0);
        status.Pending.Should().Be(1);
    }
}
