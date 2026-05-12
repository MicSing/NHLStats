using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class SplitBetIntoBetAndBetLeg : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Create the new BetLegs table while Bets still holds the legacy per-bet columns.
            migrationBuilder.CreateTable(
                name: "BetLegs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BetId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MatchId = table.Column<int>(type: "INTEGER", nullable: false),
                    BetType = table.Column<int>(type: "INTEGER", nullable: false),
                    UserId = table.Column<int>(type: "INTEGER", nullable: true),
                    TeamId = table.Column<int>(type: "INTEGER", nullable: true),
                    Odds = table.Column<decimal>(type: "TEXT", nullable: false),
                    Status = table.Column<int>(type: "INTEGER", nullable: false)
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

            // 2) Backfill: every legacy Bet row becomes a single-leg ticket. Leg.Status maps 1:1
            //    from Bet.Status (Pending=0, Won=1, Lost=2, Cancelled=3 in both enums).
            migrationBuilder.Sql(@"
                INSERT INTO ""BetLegs"" (""BetId"", ""MatchId"", ""BetType"", ""UserId"", ""TeamId"", ""Odds"", ""Status"")
                SELECT ""Id"", ""MatchId"", ""BetType"", ""UserId"", ""TeamId"", ""Odds"", ""Status"" FROM ""Bets"";
            ");

            // 3) Now drop legacy per-bet columns and rename Amount/Odds to Stake/TotalOdds.
            migrationBuilder.DropForeignKey(
                name: "FK_Bets_Matches_MatchId",
                table: "Bets");

            migrationBuilder.DropForeignKey(
                name: "FK_Bets_Teams_TeamId",
                table: "Bets");

            migrationBuilder.DropForeignKey(
                name: "FK_Bets_Users_UserId",
                table: "Bets");

            migrationBuilder.DropIndex(
                name: "IX_Bets_MatchId_CreatedBy",
                table: "Bets");

            migrationBuilder.DropIndex(
                name: "IX_Bets_TeamId",
                table: "Bets");

            migrationBuilder.DropIndex(
                name: "IX_Bets_UserId",
                table: "Bets");

            migrationBuilder.DropColumn(
                name: "BetType",
                table: "Bets");

            migrationBuilder.DropColumn(
                name: "MatchId",
                table: "Bets");

            migrationBuilder.DropColumn(
                name: "TeamId",
                table: "Bets");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Bets");

            migrationBuilder.RenameColumn(
                name: "Odds",
                table: "Bets",
                newName: "TotalOdds");

            migrationBuilder.RenameColumn(
                name: "Amount",
                table: "Bets",
                newName: "Stake");

            migrationBuilder.CreateIndex(
                name: "IX_Bets_CreatedBy",
                table: "Bets",
                column: "CreatedBy");

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BetLegs");

            migrationBuilder.DropIndex(
                name: "IX_Bets_CreatedBy",
                table: "Bets");

            migrationBuilder.RenameColumn(
                name: "TotalOdds",
                table: "Bets",
                newName: "Odds");

            migrationBuilder.RenameColumn(
                name: "Stake",
                table: "Bets",
                newName: "Amount");

            migrationBuilder.AddColumn<int>(
                name: "BetType",
                table: "Bets",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MatchId",
                table: "Bets",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TeamId",
                table: "Bets",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Bets",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bets_MatchId_CreatedBy",
                table: "Bets",
                columns: new[] { "MatchId", "CreatedBy" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bets_TeamId",
                table: "Bets",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Bets_UserId",
                table: "Bets",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Bets_Matches_MatchId",
                table: "Bets",
                column: "MatchId",
                principalTable: "Matches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Bets_Teams_TeamId",
                table: "Bets",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Bets_Users_UserId",
                table: "Bets",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
