using Microsoft.EntityFrameworkCore;
using NHLStats.Domain;
using NHLStats.Domain.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.IO;
using System.Text;
using NHLStats.Application.Caching;
using NHLStats.Application.Interfaces;
using NHLStats.Application.Services;
using NHLStats.Api.Hubs;
using NHLStats.Api.Services;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddOpenApi();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));

// Bind JWT settings
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtSecret = jwtSection["Secret"] ?? "dev-secret-please-change";
var jwtIssuer = jwtSection["Issuer"] ?? "NHLStats";
var jwtAudience = jwtSection["Audience"] ?? "NHLStatsClient";

// Identity and Auth
builder.Services.AddIdentity<ApplicationUser, AppRole>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.User.RequireUniqueEmail = false;
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
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    })
    .AddJwtBearer("RefreshBearer", options =>
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
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };
    });

builder.Services.AddAuthorization();

// CORS — allow Vite dev server (and any prod origins set via env var)
var allowedOrigins = (builder.Configuration["AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

builder.Services.AddSignalR();
builder.Services.AddHttpContextAccessor();

// Application services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<ISeasonService, SeasonService>();
builder.Services.AddScoped<IPositionWheelService, PositionWheelService>();
builder.Services.AddScoped<IMatchService, MatchService>();
builder.Services.AddSingleton<IOddsRecalculationTracker>(_ => new OddsRecalculationTracker());
builder.Services.AddSingleton<OddsRecalculationLock>();
builder.Services.AddScoped<IPointReasonService, PointReasonService>();
builder.Services.AddScoped<IMoneyConfigService, MoneyConfigService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();
builder.Services.AddScoped<IRosterPlayerService, RosterPlayerService>();
builder.Services.AddScoped<IUserMatchService, UserMatchService>();
builder.Services.AddScoped<IMatchEventService, MatchEventService>();
builder.Services.AddScoped<IBettingCalculator, BettingCalculator>();
builder.Services.AddScoped<IBettingBalanceService, BettingBalanceService>();
builder.Services.AddScoped<IBettingOddsService, BettingOddsService>();
builder.Services.AddScoped<IBetService, BetService>();
builder.Services.AddScoped<IPointManagementService, PointManagementService>();
builder.Services.AddScoped<ISeasonStatsService, SeasonStatsService>();
builder.Services.AddScoped<IRosterStatsService, RosterStatsService>();
builder.Services.AddScoped<IEarningsService, EarningsService>();
builder.Services.AddScoped<IMatchStatsService, MatchStatsService>();
builder.Services.AddScoped<IMatchupService, MatchupService>();
builder.Services.AddScoped<ITeamStatsService, TeamStatsService>();
builder.Services.AddScoped<IStatsService, StatsService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IStatsCache, StatsCache>();
builder.Services.AddSingleton<StatsCacheInvalidationInterceptor>();
builder.Services.AddScoped<IUserPayoutService, UserPayoutService>();
builder.Services.AddScoped<ISeasonEventBroadcaster, SignalRSeasonEventBroadcaster>();
builder.Services.AddScoped<ICurrentActorProvider, HttpContextCurrentActorProvider>();
builder.Services.AddScoped<IRealSeasonMatchImportService, RealSeasonMatchImportService>();
builder.Services.AddHttpClient<INhlScheduleClient, NhlScheduleClient>(client =>
{
    client.BaseAddress = new Uri("https://api-web.nhle.com/");
    client.Timeout = TimeSpan.FromSeconds(30);
});

var sqlConn = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");
builder.Services.AddDbContext<NhlStatsDbContext>((sp, options) => options
    .UseSqlServer(sqlConn, sqlOptions => sqlOptions.EnableRetryOnFailure())
    .AddInterceptors(sp.GetRequiredService<StatsCacheInvalidationInterceptor>()));

var app = builder.Build();

// Ensure database exists and apply migrations
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var ctx = services.GetRequiredService<NhlStatsDbContext>();
    try
    {
        if (app.Environment.IsEnvironment("Testing"))
        {
            // Integration tests use SQLite; create schema directly from model to avoid provider-specific migration SQL.
            ctx.Database.EnsureCreated();
        }
        else
        {
            ctx.Database.Migrate();
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Failed to migrate DB: {ex}");
    }

    // One-time (but idempotent/cheap to re-run) backfill of BetLeg.Probability for legs that
    // predate that field, so historical tickets can be repriced to any odds formula version —
    // see BetService.BackfillLegacyProbabilitiesAsync.
    try
    {
        var betService = services.GetRequiredService<IBetService>();
        var backfilled = betService.BackfillLegacyProbabilitiesAsync().GetAwaiter().GetResult();
        if (backfilled > 0)
            Console.WriteLine($"Backfilled base probability for {backfilled} historical bet leg(s).");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Failed to backfill historical bet leg probabilities: {ex}");
    }

    // Seed roles and admin user if not present
    try
    {
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = services.GetRequiredService<RoleManager<AppRole>>();
        var config = services.GetRequiredService<IConfiguration>();
        // Prefer IConfiguration (covers env vars, appsettings, and test overrides via UseSetting)
        var adminEmail = config["ADMIN_EMAIL"] ?? Environment.GetEnvironmentVariable("ADMIN_EMAIL") ?? "admin@nhlstats.local";
        var adminPassword = config["ADMIN_PASSWORD"] ?? Environment.GetEnvironmentVariable("ADMIN_PASSWORD") ?? "P@ssw0rd!";

        if (!roleManager.RoleExistsAsync(RoleNames.Admin).GetAwaiter().GetResult())
        {
            roleManager.CreateAsync(new AppRole { Name = RoleNames.Admin }).GetAwaiter().GetResult();
        }

        if (!roleManager.RoleExistsAsync(RoleNames.Participient).GetAwaiter().GetResult())
        {
            roleManager.CreateAsync(new AppRole { Name = RoleNames.Participient }).GetAwaiter().GetResult();
        }

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
                userManager.AddToRoleAsync(admin, RoleNames.Participient).GetAwaiter().GetResult();
                userManager.AddToRoleAsync(admin, RoleNames.Admin).GetAwaiter().GetResult();
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

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<SeasonEventsHub>("/hubs/season-events");

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Health endpoint: reports healthy only when the API is up AND the database
// is actually reachable, so callers (e.g. a frontend "waking up" gate) can
// tell a live app from one whose DB has auto-paused / is still resuming.
// With ?wait=N (seconds, max 60) the request is held open and the DB retried
// server-side until it answers or the deadline passes, so a waking client needs
// one long request instead of polling — and learns the moment the DB is up.
app.MapGet("/health", async (NhlStatsDbContext ctx, HttpContext http, int? wait) =>
{
    var waitFor = TimeSpan.FromSeconds(Math.Clamp(wait ?? 0, 0, 60));
    var deadline = DateTime.UtcNow + waitFor;
    // The first attempt triggers the DB resume, which can't finish in under ~10s,
    // so back off before re-trying and only then check more often.
    TimeSpan[] retryDelays = [TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(3)];

    for (var attempt = 0; ; attempt++)
    {
        var remaining = deadline - DateTime.UtcNow;
        var attemptTimeout = remaining > TimeSpan.Zero && remaining < TimeSpan.FromSeconds(10)
            ? remaining
            : TimeSpan.FromSeconds(10);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(http.RequestAborted);
        cts.CancelAfter(attemptTimeout);
        try
        {
            if (await ctx.Database.CanConnectAsync(cts.Token))
                return Results.Text("{\"status\":\"Healthy\"}", "application/json");
        }
        catch (Exception ex) when (!http.RequestAborted.IsCancellationRequested)
        {
            Console.Error.WriteLine($"Health check DB connectivity failed: {ex.Message}");
        }

        remaining = deadline - DateTime.UtcNow;
        if (remaining <= TimeSpan.Zero || http.RequestAborted.IsCancellationRequested)
            return Results.Text("{\"status\":\"Unhealthy\"}", "application/json", statusCode: StatusCodes.Status503ServiceUnavailable);

        var delay = retryDelays[Math.Min(attempt, retryDelays.Length - 1)];
        try
        {
            await Task.Delay(delay < remaining ? delay : remaining, http.RequestAborted);
        }
        catch (OperationCanceledException)
        {
            return Results.Text("{\"status\":\"Unhealthy\"}", "application/json", statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
})
    .WithName("HealthCheck");


app.Run();

// Expose Program class for WebApplicationFactory in integration tests
public partial class Program { }
