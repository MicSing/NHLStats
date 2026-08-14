using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppRoles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Bets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Stake = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalOdds = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EvaluatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MoneyConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NegativePointValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PositivePointValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MoneyConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PointReasons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PointType = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PointReasons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Teams",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ShortName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LeagueType = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teams", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AppRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AppRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Seasons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    HostedTeamId = table.Column<int>(type: "int", nullable: true),
                    StartedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    ParentSeasonId = table.Column<int>(type: "int", nullable: true),
                    LeagueType = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Seasons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Seasons_Seasons_ParentSeasonId",
                        column: x => x.ParentSeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Seasons_Teams_HostedTeamId",
                        column: x => x.HostedTeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    Alias = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    UserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SecurityStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "bit", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "bit", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUsers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Matches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeasonId = table.Column<int>(type: "int", nullable: false),
                    MatchNumber = table.Column<int>(type: "int", nullable: false),
                    HomeTeamId = table.Column<int>(type: "int", nullable: false),
                    AwayTeamId = table.Column<int>(type: "int", nullable: false),
                    HomeScore = table.Column<int>(type: "int", nullable: false),
                    AwayScore = table.Column<int>(type: "int", nullable: false),
                    MatchDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletionType = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Matches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Matches_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Matches_Teams_AwayTeamId",
                        column: x => x.AwayTeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Matches_Teams_HomeTeamId",
                        column: x => x.HomeTeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RosterPlayers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FirstName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Surname = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Position = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TeamId = table.Column<int>(type: "int", nullable: false),
                    SeasonId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RosterPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RosterPlayers_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RosterPlayers_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SeasonUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeasonId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonUsers_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeasonUsers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserPayouts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    SeasonId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaidOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPayouts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPayouts_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserPayouts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserSeasonAggregatedData",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    SeasonId = table.Column<int>(type: "int", nullable: false),
                    TotalPlus = table.Column<int>(type: "int", nullable: false),
                    TotalMinus = table.Column<int>(type: "int", nullable: false),
                    MatchesPlayed = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSeasonAggregatedData", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSeasonAggregatedData_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserSeasonAggregatedData_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ClaimType = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ClaimValue = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderKey = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    LoginProvider = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LoginRoleRelations",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    RoleId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginRoleRelations", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_LoginRoleRelations_AppRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AppRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LoginRoleRelations_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BetLegs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MatchId = table.Column<int>(type: "int", nullable: false),
                    BetType = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    TeamId = table.Column<int>(type: "int", nullable: true),
                    Odds = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Occasions = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    EvaluatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BetLegs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BetLegs_Bets_BetId",
                        column: x => x.BetId,
                        principalTable: "Bets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BetLegs_Matches_MatchId",
                        column: x => x.MatchId,
                        principalTable: "Matches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BetLegs_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BetLegs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MatchOdds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MatchId = table.Column<int>(type: "int", nullable: false),
                    BetType = table.Column<int>(type: "int", nullable: false),
                    TargetId = table.Column<int>(type: "int", nullable: true),
                    Probability = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Odds = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ComputedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchOdds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatchOdds_Matches_MatchId",
                        column: x => x.MatchId,
                        principalTable: "Matches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    MatchId = table.Column<int>(type: "int", nullable: false),
                    SeasonId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserMatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserMatches_Matches_MatchId",
                        column: x => x.MatchId,
                        principalTable: "Matches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserMatches_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserMatches_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMatchGoals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(type: "int", nullable: false),
                    RosterPlayerId = table.Column<int>(type: "int", nullable: false),
                    Count = table.Column<int>(type: "int", nullable: false),
                    GoalType = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserMatchGoals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserMatchGoals_RosterPlayers_RosterPlayerId",
                        column: x => x.RosterPlayerId,
                        principalTable: "RosterPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserMatchGoals_UserMatches_UserMatchId",
                        column: x => x.UserMatchId,
                        principalTable: "UserMatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMatchPenalties",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(type: "int", nullable: false),
                    RosterPlayerId = table.Column<int>(type: "int", nullable: false),
                    Count = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserMatchPenalties", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserMatchPenalties_RosterPlayers_RosterPlayerId",
                        column: x => x.RosterPlayerId,
                        principalTable: "RosterPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserMatchPenalties_UserMatches_UserMatchId",
                        column: x => x.UserMatchId,
                        principalTable: "UserMatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMatchPoints",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(type: "int", nullable: false),
                    PointReasonId = table.Column<int>(type: "int", nullable: false),
                    Count = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserMatchPoints", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserMatchPoints_PointReasons_PointReasonId",
                        column: x => x.PointReasonId,
                        principalTable: "PointReasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserMatchPoints_UserMatches_UserMatchId",
                        column: x => x.UserMatchId,
                        principalTable: "UserMatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "MoneyConfigs",
                columns: new[] { "Id", "EffectiveFrom", "NegativePointValue", "PositivePointValue" },
                values: new object[] { 1, new DateTime(2000, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), 0.50m, 0.25m });

            migrationBuilder.InsertData(
                table: "PointReasons",
                columns: new[] { "Id", "IsActive", "Name", "PointType" },
                values: new object[,]
                {
                    { 1, true, "Penalty", 0 },
                    { 2, true, "Secondary Penalty", 0 },
                    { 3, true, "Not Scoring A Goal", 0 },
                    { 4, true, "Scoring 10 Goals", 0 },
                    { 5, true, "Last Minute Action", 0 },
                    { 6, true, "Own Goal", 0 },
                    { 7, true, "Error In Defense", 0 },
                    { 9, true, "Penalty", 1 },
                    { 10, true, "Secondary Penalty", 1 },
                    { 11, true, "Not Scoring A Goal", 1 },
                    { 12, true, "Scoring 10 Goals", 1 },
                    { 13, true, "Last Minute Action", 1 },
                    { 14, true, "Own Goal", 1 },
                    { 15, true, "Error In Defense", 1 },
                    { 17, true, "Shorthanded Goal", 2 },
                    { 18, true, "Secondary Shorthanded Goal", 2 },
                    { 19, true, "Offside", 0 },
                    { 20, true, "Icing", 0 },
                    { 21, true, "Offside", 2 },
                    { 22, true, "Icing", 2 }
                });

            migrationBuilder.InsertData(
                table: "Teams",
                columns: new[] { "Id", "LeagueType", "Name", "ShortName" },
                values: new object[,]
                {
                    { 1, 0, "Anaheim Ducks", "ANA" },
                    { 2, 0, "Arizona Coyotes", "ARI" },
                    { 3, 0, "Boston Bruins", "BOS" },
                    { 4, 0, "Buffalo Sabres", "BUF" },
                    { 5, 0, "Calgary Flames", "CGY" },
                    { 6, 0, "Carolina Hurricanes", "CAR" },
                    { 7, 0, "Chicago Blackhawks", "CHI" },
                    { 8, 0, "Colorado Avalanche", "COL" },
                    { 9, 0, "Columbus Blue Jackets", "CBJ" },
                    { 10, 0, "Dallas Stars", "DAL" },
                    { 11, 0, "Detroit Red Wings", "DET" },
                    { 12, 0, "Edmonton Oilers", "EDM" },
                    { 13, 0, "Florida Panthers", "FLA" },
                    { 14, 0, "Los Angeles Kings", "LAK" },
                    { 15, 0, "Minnesota Wild", "MIN" },
                    { 16, 0, "Montréal Canadiens", "MTL" },
                    { 17, 0, "Nashville Predators", "NSH" },
                    { 18, 0, "New Jersey Devils", "NJD" },
                    { 19, 0, "New York Islanders", "NYI" },
                    { 20, 0, "New York Rangers", "NYR" },
                    { 21, 0, "Ottawa Senators", "OTT" },
                    { 22, 0, "Philadelphia Flyers", "PHI" },
                    { 23, 0, "Pittsburgh Penguins", "PIT" },
                    { 24, 0, "San Jose Sharks", "SJS" },
                    { 25, 0, "Seattle Kraken", "SEA" },
                    { 26, 0, "St. Louis Blues", "STL" },
                    { 27, 0, "Tampa Bay Lightning", "TBL" },
                    { 28, 0, "Toronto Maple Leafs", "TOR" },
                    { 29, 0, "Vancouver Canucks", "VAN" },
                    { 30, 0, "Vegas Golden Knights", "VGK" },
                    { 31, 0, "Washington Capitals", "WSH" },
                    { 32, 0, "Winnipeg Jets", "WPG" }
                });

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AppRoles",
                column: "NormalizedName",
                unique: true,
                filter: "[NormalizedName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_Alias",
                table: "AspNetUsers",
                column: "Alias",
                unique: true,
                filter: "\"Alias\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUsers_UserId",
                table: "AspNetUsers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true,
                filter: "[NormalizedUserName] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_BetLegs_BetId",
                table: "BetLegs",
                column: "BetId");

            migrationBuilder.CreateIndex(
                name: "IX_BetLegs_MatchId_BetType",
                table: "BetLegs",
                columns: new[] { "MatchId", "BetType" });

            migrationBuilder.CreateIndex(
                name: "IX_BetLegs_TeamId",
                table: "BetLegs",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_BetLegs_UserId",
                table: "BetLegs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Bets_CreatedBy",
                table: "Bets",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_LoginRoleRelations_RoleId",
                table: "LoginRoleRelations",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Matches_AwayTeamId",
                table: "Matches",
                column: "AwayTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Matches_HomeTeamId",
                table: "Matches",
                column: "HomeTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Matches_SeasonId_MatchNumber",
                table: "Matches",
                columns: new[] { "SeasonId", "MatchNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MatchOdds_MatchId_BetType_TargetId",
                table: "MatchOdds",
                columns: new[] { "MatchId", "BetType", "TargetId" },
                unique: true,
                filter: "[TargetId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_RosterPlayers_SeasonId",
                table: "RosterPlayers",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_RosterPlayers_TeamId",
                table: "RosterPlayers",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_HostedTeamId",
                table: "Seasons",
                column: "HostedTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Seasons_ParentSeasonId",
                table: "Seasons",
                column: "ParentSeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonUsers_SeasonId_UserId",
                table: "SeasonUsers",
                columns: new[] { "SeasonId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonUsers_UserId",
                table: "SeasonUsers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatches_MatchId",
                table: "UserMatches",
                column: "MatchId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatches_SeasonId",
                table: "UserMatches",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatches_UserId",
                table: "UserMatches",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchGoals_RosterPlayerId",
                table: "UserMatchGoals",
                column: "RosterPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchGoals_UserMatchId",
                table: "UserMatchGoals",
                column: "UserMatchId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchPenalties_RosterPlayerId",
                table: "UserMatchPenalties",
                column: "RosterPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchPenalties_UserMatchId",
                table: "UserMatchPenalties",
                column: "UserMatchId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchPoints_PointReasonId",
                table: "UserMatchPoints",
                column: "PointReasonId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchPoints_UserMatchId",
                table: "UserMatchPoints",
                column: "UserMatchId");

            migrationBuilder.CreateIndex(
                name: "IX_UserPayouts_SeasonId",
                table: "UserPayouts",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_UserPayouts_UserId",
                table: "UserPayouts",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSeasonAggregatedData_SeasonId",
                table: "UserSeasonAggregatedData",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_UserSeasonAggregatedData_UserId_SeasonId",
                table: "UserSeasonAggregatedData",
                columns: new[] { "UserId", "SeasonId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "BetLegs");

            migrationBuilder.DropTable(
                name: "Expenses");

            migrationBuilder.DropTable(
                name: "LoginRoleRelations");

            migrationBuilder.DropTable(
                name: "MatchOdds");

            migrationBuilder.DropTable(
                name: "MoneyConfigs");

            migrationBuilder.DropTable(
                name: "SeasonUsers");

            migrationBuilder.DropTable(
                name: "UserMatchGoals");

            migrationBuilder.DropTable(
                name: "UserMatchPenalties");

            migrationBuilder.DropTable(
                name: "UserMatchPoints");

            migrationBuilder.DropTable(
                name: "UserPayouts");

            migrationBuilder.DropTable(
                name: "UserSeasonAggregatedData");

            migrationBuilder.DropTable(
                name: "Bets");

            migrationBuilder.DropTable(
                name: "AppRoles");

            migrationBuilder.DropTable(
                name: "AspNetUsers");

            migrationBuilder.DropTable(
                name: "RosterPlayers");

            migrationBuilder.DropTable(
                name: "PointReasons");

            migrationBuilder.DropTable(
                name: "UserMatches");

            migrationBuilder.DropTable(
                name: "Matches");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Seasons");

            migrationBuilder.DropTable(
                name: "Teams");
        }
    }
}
