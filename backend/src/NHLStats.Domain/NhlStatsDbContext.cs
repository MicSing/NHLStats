using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using NHLStats.Domain.Entities;
using NHLStats.Domain.Identity;

namespace NHLStats.Domain;

public class NhlStatsDbContext : IdentityDbContext<ApplicationUser, AppRole, string,
    IdentityUserClaim<string>, LoginRoleRelation, IdentityUserLogin<string>,
    IdentityRoleClaim<string>, IdentityUserToken<string>>
{
    public NhlStatsDbContext(DbContextOptions<NhlStatsDbContext> options) : base(options)
    {
    }

    public new DbSet<User> Users => Set<User>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<SeasonUser> SeasonUsers => Set<SeasonUser>();
    public DbSet<Match> Matches => Set<Match>();
    public DbSet<RosterPlayer> RosterPlayers => Set<RosterPlayer>();
    public DbSet<PointReason> PointReasons => Set<PointReason>();
    public DbSet<UserMatch> UserMatches => Set<UserMatch>();
    public DbSet<UserMatchPoint> UserMatchPoints => Set<UserMatchPoint>();
    public DbSet<UserMatchGoal> UserMatchGoals => Set<UserMatchGoal>();
    public DbSet<UserMatchPenalty> UserMatchPenalties => Set<UserMatchPenalty>();
    public DbSet<MoneyConfig> MoneyConfigs => Set<MoneyConfig>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<UserPayout> UserPayouts => Set<UserPayout>();
    public DbSet<Bet> Bets => Set<Bet>();
    public DbSet<UserSeasonAggregatedData> UserSeasonAggregatedData => Set<UserSeasonAggregatedData>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AppRole>().ToTable("AppRoles");
        modelBuilder.Entity<LoginRoleRelation>().ToTable("LoginRoleRelations");

        modelBuilder.Entity<ApplicationUser>(b =>
        {
            b.HasOne(u => u.User)
                .WithMany()
                .HasForeignKey(u => u.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired();
        });

        modelBuilder.Entity<Team>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired();
            b.Property(x => x.ShortName).IsRequired();
        });

        modelBuilder.Entity<Season>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired();
            b.HasOne(x => x.HostedTeam).WithMany().HasForeignKey(x => x.HostedTeamId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.ParentSeason).WithMany().HasForeignKey(x => x.ParentSeasonId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SeasonUser>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.SeasonId, x.UserId }).IsUnique();
            b.HasOne(x => x.Season).WithMany(s => s.SeasonUsers).HasForeignKey(x => x.SeasonId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.User).WithMany(u => u.SeasonUsers).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Match>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.SeasonId, x.MatchNumber }).IsUnique();
            b.HasOne(x => x.Season).WithMany(s => s.Matches).HasForeignKey(x => x.SeasonId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.HomeTeam).WithMany(t => t.HomeMatches).HasForeignKey(x => x.HomeTeamId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.AwayTeam).WithMany(t => t.AwayMatches).HasForeignKey(x => x.AwayTeamId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RosterPlayer>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.Team).WithMany(t => t.RosterPlayers).HasForeignKey(x => x.TeamId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Season).WithMany(s => s.RosterPlayers).HasForeignKey(x => x.SeasonId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PointReason>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired();
        });

        modelBuilder.Entity<UserMatch>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.User).WithMany(u => u.UserMatches).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Match).WithMany(m => m.UserMatches).HasForeignKey(x => x.MatchId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Season).WithMany().HasForeignKey(x => x.SeasonId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserSeasonAggregatedData>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Season).WithMany().HasForeignKey(x => x.SeasonId).OnDelete(DeleteBehavior.Cascade);
            b.HasIndex(x => new { x.UserId, x.SeasonId }).IsUnique();
        });

        modelBuilder.Entity<UserMatchPoint>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.UserMatch).WithMany(um => um.Points).HasForeignKey(x => x.UserMatchId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.PointReason).WithMany().HasForeignKey(x => x.PointReasonId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserMatchGoal>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.UserMatch).WithMany(um => um.Goals).HasForeignKey(x => x.UserMatchId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.RosterPlayer).WithMany().HasForeignKey(x => x.RosterPlayerId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserMatchPenalty>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.UserMatch).WithMany(um => um.Penalties).HasForeignKey(x => x.UserMatchId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.RosterPlayer).WithMany().HasForeignKey(x => x.RosterPlayerId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MoneyConfig>(b =>
        {
            b.HasKey(x => x.Id);
        });

        modelBuilder.Entity<Expense>(b =>
        {
            b.HasKey(x => x.Id);
        });

        modelBuilder.Entity<UserPayout>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Season).WithMany().HasForeignKey(x => x.SeasonId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Bet>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.CreatedBy).IsRequired();
            b.HasIndex(x => new { x.MatchId, x.CreatedBy }).IsUnique();
            b.HasOne(x => x.Match).WithMany(m => m.Bets).HasForeignKey(x => x.MatchId).OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.User).WithMany(u => u.Bets).HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Team).WithMany(t => t.Bets).HasForeignKey(x => x.TeamId).OnDelete(DeleteBehavior.Restrict);
        });

        // Seed data: 32 NHL teams
        var teams = new List<Team>
        {
            new Team{ Id=1, Name="Anaheim Ducks", ShortName="ANA"},
            new Team{ Id=2, Name="Arizona Coyotes", ShortName="ARI"},
            new Team{ Id=3, Name="Boston Bruins", ShortName="BOS"},
            new Team{ Id=4, Name="Buffalo Sabres", ShortName="BUF"},
            new Team{ Id=5, Name="Calgary Flames", ShortName="CGY"},
            new Team{ Id=6, Name="Carolina Hurricanes", ShortName="CAR"},
            new Team{ Id=7, Name="Chicago Blackhawks", ShortName="CHI"},
            new Team{ Id=8, Name="Colorado Avalanche", ShortName="COL"},
            new Team{ Id=9, Name="Columbus Blue Jackets", ShortName="CBJ"},
            new Team{ Id=10, Name="Dallas Stars", ShortName="DAL"},
            new Team{ Id=11, Name="Detroit Red Wings", ShortName="DET"},
            new Team{ Id=12, Name="Edmonton Oilers", ShortName="EDM"},
            new Team{ Id=13, Name="Florida Panthers", ShortName="FLA"},
            new Team{ Id=14, Name="Los Angeles Kings", ShortName="LAK"},
            new Team{ Id=15, Name="Minnesota Wild", ShortName="MIN"},
            new Team{ Id=16, Name="Montréal Canadiens", ShortName="MTL"},
            new Team{ Id=17, Name="Nashville Predators", ShortName="NSH"},
            new Team{ Id=18, Name="New Jersey Devils", ShortName="NJD"},
            new Team{ Id=19, Name="New York Islanders", ShortName="NYI"},
            new Team{ Id=20, Name="New York Rangers", ShortName="NYR"},
            new Team{ Id=21, Name="Ottawa Senators", ShortName="OTT"},
            new Team{ Id=22, Name="Philadelphia Flyers", ShortName="PHI"},
            new Team{ Id=23, Name="Pittsburgh Penguins", ShortName="PIT"},
            new Team{ Id=24, Name="San Jose Sharks", ShortName="SJS"},
            new Team{ Id=25, Name="Seattle Kraken", ShortName="SEA"},
            new Team{ Id=26, Name="St. Louis Blues", ShortName="STL"},
            new Team{ Id=27, Name="Tampa Bay Lightning", ShortName="TBL"},
            new Team{ Id=28, Name="Toronto Maple Leafs", ShortName="TOR"},
            new Team{ Id=29, Name="Vancouver Canucks", ShortName="VAN"},
            new Team{ Id=30, Name="Vegas Golden Knights", ShortName="VGK"},
            new Team{ Id=31, Name="Washington Capitals", ShortName="WSH"},
            new Team{ Id=32, Name="Winnipeg Jets", ShortName="WPG"},
        };

        modelBuilder.Entity<Team>().HasData(teams);

        // Seed point reasons
        var pointReasons = new List<PointReason>
        {
            // Negative reasons
            new PointReason{ Id=1, Name="Penalty", IsPositive=false, IsActive=true},
            new PointReason{ Id=2, Name="Secondary Penalty", IsPositive=false, IsActive=true},
            new PointReason{ Id=3, Name="Not Scoring A Goal", IsPositive=false, IsActive=true},
            new PointReason{ Id=4, Name="Scoring 10 Goals", IsPositive=false, IsActive=true},
            new PointReason{ Id=5, Name="Last Minute Action", IsPositive=false, IsActive=true},
            new PointReason{ Id=6, Name="Own Goal", IsPositive=false, IsActive=true},
            new PointReason{ Id=7, Name="Error In Defense", IsPositive=false, IsActive=true},
            new PointReason{ Id=8, Name="Prediction", IsPositive=false, IsActive=true},
            // Positive reasons (mirrors of the above)
            new PointReason{ Id=9,  Name="Penalty", IsPositive=true, IsActive=true},
            new PointReason{ Id=10, Name="Secondary Penalty", IsPositive=true, IsActive=true},
            new PointReason{ Id=11, Name="Not Scoring A Goal", IsPositive=true, IsActive=true},
            new PointReason{ Id=12, Name="Scoring 10 Goals", IsPositive=true, IsActive=true},
            new PointReason{ Id=13, Name="Last Minute Action", IsPositive=true, IsActive=true},
            new PointReason{ Id=14, Name="Own Goal", IsPositive=true, IsActive=true},
            new PointReason{ Id=15, Name="Error In Defense", IsPositive=true, IsActive=true},
            new PointReason{ Id=16, Name="Prediction", IsPositive=true, IsActive=true},
        };

        modelBuilder.Entity<PointReason>().HasData(pointReasons);

        // Default money config
        modelBuilder.Entity<MoneyConfig>().HasData(new MoneyConfig
        {
            Id = 1,
            NegativePointValue = 0.50m,
            PositivePointValue = 0.25m,
            EffectiveFrom = new DateTime(2000, 1, 1)
        });
    }
}
