using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class Phase16_BettingRewrite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 16);

            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "UserMatchPoints",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedOn",
                table: "UserMatchPoints",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "Bets",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Odds",
                table: "Bets",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Bets",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            // Backfill Amount for existing UserMatchPoints based on MoneyConfig effective at match date
            migrationBuilder.Sql(@"
UPDATE UserMatchPoints
SET Amount = (
    SELECT CASE
        WHEN pr.PointType = 0 THEN UserMatchPoints.""Count"" * mc.NegativePointValue
        WHEN pr.PointType = 1 THEN UserMatchPoints.""Count"" * mc.PositivePointValue
        ELSE 0
    END
    FROM PointReasons pr,
         UserMatches um,
         Matches m,
         MoneyConfigs mc
    WHERE pr.Id = UserMatchPoints.PointReasonId
      AND um.Id = UserMatchPoints.UserMatchId
      AND m.Id = um.MatchId
      AND mc.Id = (
          SELECT mc2.Id FROM MoneyConfigs mc2
          WHERE mc2.EffectiveFrom <= COALESCE(m.MatchDate, datetime('now'))
          ORDER BY mc2.EffectiveFrom DESC
          LIMIT 1
      )
),
CreatedOn = (
    SELECT m.MatchDate
    FROM UserMatches um
    INNER JOIN Matches m ON m.Id = um.MatchId
    WHERE um.Id = UserMatchPoints.UserMatchId
)
WHERE EXISTS (SELECT 1 FROM UserMatches um WHERE um.Id = UserMatchPoints.UserMatchId);
");

            // Fallback: rows where no MoneyConfig was found (Amount still 0, pr.PointType = 0) default to 0.50 per count
            migrationBuilder.Sql(@"
UPDATE UserMatchPoints
SET Amount = (
    SELECT CASE
        WHEN pr.PointType = 0 THEN UserMatchPoints.""Count"" * 0.50
        WHEN pr.PointType = 1 THEN UserMatchPoints.""Count"" * 1.00
        ELSE 0
    END
    FROM PointReasons pr
    WHERE pr.Id = UserMatchPoints.PointReasonId
)
WHERE Amount = 0 AND EXISTS (
    SELECT 1 FROM PointReasons pr
    WHERE pr.Id = UserMatchPoints.PointReasonId AND pr.PointType != 2
);
");

            migrationBuilder.CreateTable(
                name: "MatchOdds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    MatchId = table.Column<int>(type: "INTEGER", nullable: false),
                    BetType = table.Column<int>(type: "INTEGER", nullable: false),
                    TargetId = table.Column<int>(type: "INTEGER", nullable: true),
                    Probability = table.Column<decimal>(type: "TEXT", nullable: false),
                    Odds = table.Column<decimal>(type: "TEXT", nullable: false),
                    ComputedOn = table.Column<DateTime>(type: "TEXT", nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_MatchOdds_MatchId_BetType_TargetId",
                table: "MatchOdds",
                columns: new[] { "MatchId", "BetType", "TargetId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MatchOdds");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "UserMatchPoints");

            migrationBuilder.DropColumn(
                name: "CreatedOn",
                table: "UserMatchPoints");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "Bets");

            migrationBuilder.DropColumn(
                name: "Odds",
                table: "Bets");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Bets");

            migrationBuilder.InsertData(
                table: "PointReasons",
                columns: new[] { "Id", "IsActive", "Name", "PointType" },
                values: new object[,]
                {
                    { 8, true, "Prediction", 0 },
                    { 16, true, "Prediction", 1 }
                });
        }
    }
}
