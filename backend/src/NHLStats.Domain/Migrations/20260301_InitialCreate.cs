using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(nullable: false),
                    IsActive = table.Column<bool>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Teams",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(nullable: false),
                    ShortName = table.Column<string>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teams", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PointReasons",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(nullable: false),
                    IsPositive = table.Column<bool>(nullable: false),
                    IsActive = table.Column<bool>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PointReasons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MoneyConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NegativePointValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PositivePointValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    EffectiveFrom = table.Column<DateTime>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MoneyConfigs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Seasons",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(nullable: false),
                    HostedTeamId = table.Column<int>(nullable: true),
                    StartedOn = table.Column<DateTime>(nullable: false),
                    Status = table.Column<string>(nullable: true),
                    ParentSeasonId = table.Column<int>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Seasons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Seasons_Teams_HostedTeamId",
                        column: x => x.HostedTeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Seasons_Seasons_ParentSeasonId",
                        column: x => x.ParentSeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Matches",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeasonId = table.Column<int>(nullable: false),
                    HomeTeamId = table.Column<int>(nullable: false),
                    AwayTeamId = table.Column<int>(nullable: false),
                    HomeScore = table.Column<int>(nullable: false),
                    AwayScore = table.Column<int>(nullable: false),
                    MatchDate = table.Column<DateTime>(nullable: false)
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
                        name: "FK_Matches_Teams_HomeTeamId",
                        column: x => x.HomeTeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Matches_Teams_AwayTeamId",
                        column: x => x.AwayTeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RosterPlayers",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FirstName = table.Column<string>(nullable: false),
                    Surname = table.Column<string>(nullable: false),
                    Position = table.Column<string>(nullable: true),
                    TeamId = table.Column<int>(nullable: false),
                    SeasonId = table.Column<int>(nullable: false),
                    IsActive = table.Column<bool>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RosterPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RosterPlayers_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RosterPlayers_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SeasonUsers",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeasonId = table.Column<int>(nullable: false),
                    UserId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonUsers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonUsers_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SeasonUsers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMatches",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(nullable: false),
                    MatchId = table.Column<int>(nullable: true),
                    SeasonId = table.Column<int>(nullable: false),
                    TotalPlus = table.Column<int>(nullable: false),
                    TotalMinus = table.Column<int>(nullable: false)
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
                        name: "FK_UserMatches_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMatchPoints",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(nullable: false),
                    PointReasonId = table.Column<int>(nullable: false),
                    Count = table.Column<int>(nullable: false)
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

            migrationBuilder.CreateTable(
                name: "UserMatchGoals",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(nullable: false),
                    RosterPlayerId = table.Column<int>(nullable: false),
                    Count = table.Column<int>(nullable: false)
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
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(nullable: false),
                    RosterPlayerId = table.Column<int>(nullable: false),
                    Count = table.Column<int>(nullable: false)
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
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Description = table.Column<string>(nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Date = table.Column<DateTime>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                });

            // Indexes
            migrationBuilder.CreateIndex(name: "IX_SeasonUsers_SeasonId_UserId", table: "SeasonUsers", columns: new[] { "SeasonId", "UserId" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_Seasons_HostedTeamId", table: "Seasons", column: "HostedTeamId");
            migrationBuilder.CreateIndex(name: "IX_Seasons_ParentSeasonId", table: "Seasons", column: "ParentSeasonId");
            migrationBuilder.CreateIndex(name: "IX_Matches_SeasonId", table: "Matches", column: "SeasonId");
            migrationBuilder.CreateIndex(name: "IX_Matches_HomeTeamId", table: "Matches", column: "HomeTeamId");
            migrationBuilder.CreateIndex(name: "IX_Matches_AwayTeamId", table: "Matches", column: "AwayTeamId");
            migrationBuilder.CreateIndex(name: "IX_RosterPlayers_TeamId", table: "RosterPlayers", column: "TeamId");
            migrationBuilder.CreateIndex(name: "IX_RosterPlayers_SeasonId", table: "RosterPlayers", column: "SeasonId");
            migrationBuilder.CreateIndex(name: "IX_UserMatches_MatchId", table: "UserMatches", column: "MatchId");
            migrationBuilder.CreateIndex(name: "IX_UserMatches_UserId", table: "UserMatches", column: "UserId");
            migrationBuilder.CreateIndex(name: "IX_UserMatchPoints_UserMatchId", table: "UserMatchPoints", column: "UserMatchId");
            migrationBuilder.CreateIndex(name: "IX_UserMatchPoints_PointReasonId", table: "UserMatchPoints", column: "PointReasonId");
            migrationBuilder.CreateIndex(name: "IX_UserMatchGoals_UserMatchId", table: "UserMatchGoals", column: "UserMatchId");
            migrationBuilder.CreateIndex(name: "IX_UserMatchGoals_RosterPlayerId", table: "UserMatchGoals", column: "RosterPlayerId");
            migrationBuilder.CreateIndex(name: "IX_UserMatchPenalties_UserMatchId", table: "UserMatchPenalties", column: "UserMatchId");
            migrationBuilder.CreateIndex(name: "IX_UserMatchPenalties_RosterPlayerId", table: "UserMatchPenalties", column: "RosterPlayerId");

            // Seed Teams
            migrationBuilder.InsertData(
                table: "Teams",
                columns: new[] { "Id", "Name", "ShortName" },
                values: new object[,]
                {
                    {1, "Anaheim Ducks", "ANA"},
                    {2, "Arizona Coyotes", "ARI"},
                    {3, "Boston Bruins", "BOS"},
                    {4, "Buffalo Sabres", "BUF"},
                    {5, "Calgary Flames", "CGY"},
                    {6, "Carolina Hurricanes", "CAR"},
                    {7, "Chicago Blackhawks", "CHI"},
                    {8, "Colorado Avalanche", "COL"},
                    {9, "Columbus Blue Jackets", "CBJ"},
                    {10, "Dallas Stars", "DAL"},
                    {11, "Detroit Red Wings", "DET"},
                    {12, "Edmonton Oilers", "EDM"},
                    {13, "Florida Panthers", "FLA"},
                    {14, "Los Angeles Kings", "LAK"},
                    {15, "Minnesota Wild", "MIN"},
                    {16, "Montréal Canadiens", "MTL"},
                    {17, "Nashville Predators", "NSH"},
                    {18, "New Jersey Devils", "NJD"},
                    {19, "New York Islanders", "NYI"},
                    {20, "New York Rangers", "NYR"},
                    {21, "Ottawa Senators", "OTT"},
                    {22, "Philadelphia Flyers", "PHI"},
                    {23, "Pittsburgh Penguins", "PIT"},
                    {24, "San Jose Sharks", "SJS"},
                    {25, "Seattle Kraken", "SEA"},
                    {26, "St. Louis Blues", "STL"},
                    {27, "Tampa Bay Lightning", "TBL"},
                    {28, "Toronto Maple Leafs", "TOR"},
                    {29, "Vancouver Canucks", "VAN"},
                    {30, "Vegas Golden Knights", "VGK"},
                    {31, "Washington Capitals", "WSH"},
                    {32, "Winnipeg Jets", "WPG"}
                });

            // Seed PointReasons
            migrationBuilder.InsertData(
                table: "PointReasons",
                columns: new[] { "Id", "Name", "IsPositive", "IsActive" },
                values: new object[,]
                {
                    {1, "Penalty", false, true},
                    {2, "Secondary Penalty", false, true},
                    {3, "Not Scoring A Goal", false, true},
                    {4, "Scoring 10 Goals", true, true},
                    {5, "Last Minute Action", false, true},
                    {6, "Own Goal", false, true},
                    {7, "Error In Defense", false, true},
                    {8, "Prediction", false, true}
                });

            // Seed MoneyConfig
            migrationBuilder.InsertData(
                table: "MoneyConfigs",
                columns: new[] { "Id", "NegativePointValue", "PositivePointValue", "EffectiveFrom" },
                values: new object[] { 1, -0.50m, 0.25m, new DateTime(2000, 1, 1) });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "UserMatchPenalties");
            migrationBuilder.DropTable(name: "UserMatchGoals");
            migrationBuilder.DropTable(name: "UserMatchPoints");
            migrationBuilder.DropTable(name: "Expenses");
            migrationBuilder.DropTable(name: "MoneyConfigs");
            migrationBuilder.DropTable(name: "UserMatches");
            migrationBuilder.DropTable(name: "RosterPlayers");
            migrationBuilder.DropTable(name: "PointReasons");
            migrationBuilder.DropTable(name: "Matches");
            migrationBuilder.DropTable(name: "SeasonUsers");
            migrationBuilder.DropTable(name: "Seasons");
            migrationBuilder.DropTable(name: "Users");
            migrationBuilder.DropTable(name: "Teams");
        }
    }
}
