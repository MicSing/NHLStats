using Microsoft.EntityFrameworkCore;
using NHLStats.Domain;
using System.IO;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();

// Configure EF Core to always use SQLite and place DB under HOME/data/nhlstats.db
var home = Environment.GetEnvironmentVariable("HOME") ?? ".";
var dbDir = Path.Combine(home, "data");
try
{
    Directory.CreateDirectory(dbDir);
}
catch
{
    // best-effort, fall back to app base directory
    dbDir = AppContext.BaseDirectory;
}

var dbPath = Path.Combine(dbDir, "nhlstats.db");
var sqliteConn = $"Data Source={dbPath}";
builder.Services.AddDbContext<NhlStatsDbContext>(options => options.UseSqlite(sqliteConn));

var app = builder.Build();

// Ensure database exists for SQLite single-instance deployments
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<NhlStatsDbContext>();
    try
    {
        ctx.Database.EnsureCreated();
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Failed to ensure DB created: {ex}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Simple health endpoint for smoke tests
app.MapGet("/health", () => Results.Text("{\"status\":\"Healthy\"}", "application/json"))
    .WithName("HealthCheck");


var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

// Expose Program class for WebApplicationFactory in integration tests
public partial class Program { }

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
