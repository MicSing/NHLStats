using Microsoft.EntityFrameworkCore;
using NHLStats.Domain;
using NHLStats.Domain.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.IO;
using System.Text;
using NHLStats.Application.Interfaces;
using NHLStats.Application.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddControllers();

// Bind JWT settings
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtSecret = jwtSection["Secret"] ?? "dev-secret-please-change";
var jwtIssuer = jwtSection["Issuer"] ?? "NHLStats";
var jwtAudience = jwtSection["Audience"] ?? "NHLStatsClient";

// Identity and Auth
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.User.RequireUniqueEmail = true;
})
    .AddEntityFrameworkStores<NhlStatsDbContext>()
    .AddDefaultTokenProviders();

var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true
        };
    });

builder.Services.AddAuthorization();

// Application services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<ISeasonService, SeasonService>();
builder.Services.AddScoped<IMatchService, MatchService>();
builder.Services.AddScoped<IPointReasonService, PointReasonService>();
builder.Services.AddScoped<IMoneyConfigService, MoneyConfigService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();

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

// Ensure database exists and apply migrations
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var ctx = services.GetRequiredService<NhlStatsDbContext>();
    try
    {
        ctx.Database.Migrate();
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Failed to migrate DB: {ex}");
    }

    // Seed admin user if not present
    try
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var config = services.GetRequiredService<IConfiguration>();
        // Prefer IConfiguration (covers env vars, appsettings, and test overrides via UseSetting)
        var adminEmail = config["ADMIN_EMAIL"] ?? Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@nhlstats.local";
        var adminPassword = config["ADMIN_PASSWORD"] ?? Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "P@ssw0rd!";

        var existing = userManager.FindByEmailAsync(adminEmail).GetAwaiter().GetResult();
        if (existing == null)
        {
            var admin = new ApplicationUser { UserName = adminEmail, Email = adminEmail, EmailConfirmed = true };
            var createResult = userManager.CreateAsync(admin, adminPassword).GetAwaiter().GetResult();
            if (!createResult.Succeeded)
            {
                Console.Error.WriteLine($"Failed to create admin user: {string.Join(", ", createResult.Errors.Select(e => e.Description))}");
            }
            else
            {
                Console.WriteLine($"Created admin user: {adminEmail}");
            }
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Failed to seed admin user: {ex}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

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
