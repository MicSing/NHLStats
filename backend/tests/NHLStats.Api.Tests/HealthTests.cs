using System.Net;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NHLStats.Domain;

namespace NHLStats.Api.Tests;

public class HealthTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public HealthTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_endpoint_returns_ok_when_db_is_reachable()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/health");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await resp.Content.ReadAsStringAsync();
        content.Should().Contain("Healthy");
    }

    [Fact]
    public async Task Health_endpoint_returns_503_when_db_is_unreachable()
    {
        using var factory = new UnreachableDbWebApplicationFactory();
        var client = factory.CreateClient();
        var resp = await client.GetAsync("/health");
        resp.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var content = await resp.Content.ReadAsStringAsync();
        content.Should().Contain("Unhealthy");
    }

    [Fact]
    public async Task Health_endpoint_with_wait_returns_ok_immediately_when_db_is_reachable()
    {
        var client = _factory.CreateClient();
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var resp = await client.GetAsync("/health?wait=30");
        sw.Stop();
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        sw.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task Health_endpoint_with_wait_returns_503_after_deadline_when_db_is_unreachable()
    {
        using var factory = new UnreachableDbWebApplicationFactory();
        var client = factory.CreateClient();
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var resp = await client.GetAsync("/health?wait=1");
        sw.Stop();
        resp.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        sw.Elapsed.Should().BeGreaterThanOrEqualTo(TimeSpan.FromSeconds(1));
        sw.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(10));
    }

    /// <summary>
    /// Points the DbContext at a SQLite file whose parent directory does not exist
    /// (and cannot be created), so any connection attempt fails deterministically
    /// and without touching the network — standing in for "the database is down".
    /// </summary>
    private class UnreachableDbWebApplicationFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");

            builder.ConfigureTestServices(services =>
            {
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<NhlStatsDbContext>));
                if (descriptor != null)
                    services.Remove(descriptor);

                services.AddDbContext<NhlStatsDbContext>(options =>
                    options.UseSqlite("Data Source=/nonexistent-nhlstats-health-test/unreachable.db"));
            });
        }
    }
}
