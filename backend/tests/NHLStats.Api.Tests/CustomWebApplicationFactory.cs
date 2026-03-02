using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using NHLStats.Domain;

namespace NHLStats.Api.Tests;

/// <summary>
/// Overrides the production SQLite path with a unique temp-file SQLite database
/// so every test class gets a fresh, isolated database.
/// Using a real file (not in-memory) avoids connection-sharing edge-cases and
/// supports EF Core migrations identically to production.
/// ConfigureTestServices is used so this override always runs last and wins.
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly string _dbPath =
        Path.Combine(Path.GetTempPath(), $"nhlstats-test-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Expose test admin credentials via IConfiguration so the Program.cs
        // seed block picks them up via config["ADMIN_EMAIL"] / config["ADMIN_PASSWORD"].
        builder.UseSetting("ADMIN_EMAIL", "testadmin@nhlstats.test");
        builder.UseSetting("ADMIN_PASSWORD", "TestP@ssw0rd!");

        // ConfigureTestServices runs AFTER all Program.cs service registrations,
        // so it reliably overrides the production DbContext options.
        builder.ConfigureTestServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<NhlStatsDbContext>));
            if (descriptor != null)
                services.Remove(descriptor);

            services.AddDbContext<NhlStatsDbContext>(options =>
                options.UseSqlite($"Data Source={_dbPath}"));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            try { File.Delete(_dbPath); } catch { /* best-effort cleanup */ }
        }
    }
}
