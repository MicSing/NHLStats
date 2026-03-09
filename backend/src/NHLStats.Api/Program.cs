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

// CORS — allow Vite dev server (and any prod origins set via env var)
var allowedOrigins = (builder.Configuration["AllowedOrigins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Application services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<ISeasonService, SeasonService>();
builder.Services.AddScoped<IMatchService, MatchService>();
builder.Services.AddScoped<IPointReasonService, PointReasonService>();
builder.Services.AddScoped<IMoneyConfigService, MoneyConfigService>();
builder.Services.AddScoped<IExpenseService, ExpenseService>();
builder.Services.AddScoped<IRosterPlayerService, RosterPlayerService>();
builder.Services.AddScoped<IUserMatchService, UserMatchService>();
builder.Services.AddScoped<IBetService, BetService>();
builder.Services.AddScoped<IStatsService, StatsService>();
builder.Services.AddScoped<IUserPayoutService, UserPayoutService>();

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

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Simple health endpoint for smoke tests
app.MapGet("/health", () => Results.Text("{\"status\":\"Healthy\"}", "application/json"))
    .WithName("HealthCheck");


app.Run();

// Expose Program class for WebApplicationFactory in integration tests
public partial class Program { }
