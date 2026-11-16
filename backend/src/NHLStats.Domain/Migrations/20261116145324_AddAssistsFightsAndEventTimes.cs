using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddAssistsFightsAndEventTimes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GameClock",
                table: "MatchEvents",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Period",
                table: "MatchEvents",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Assist1RosterPlayerId",
                table: "MatchEventProposals",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Assist1UserId",
                table: "MatchEventProposals",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Assist2RosterPlayerId",
                table: "MatchEventProposals",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Assist2UserId",
                table: "MatchEventProposals",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FightOutcome",
                table: "MatchEventProposals",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UserMatchAssists",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(type: "int", nullable: false),
                    RosterPlayerId = table.Column<int>(type: "int", nullable: false),
                    UserMatchGoalId = table.Column<int>(type: "int", nullable: true),
                    MatchEventId = table.Column<int>(type: "int", nullable: true),
                    MatchEventProposalId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserMatchAssists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserMatchAssists_RosterPlayers_RosterPlayerId",
                        column: x => x.RosterPlayerId,
                        principalTable: "RosterPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserMatchAssists_UserMatches_UserMatchId",
                        column: x => x.UserMatchId,
                        principalTable: "UserMatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserMatchFights",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserMatchId = table.Column<int>(type: "int", nullable: false),
                    RosterPlayerId = table.Column<int>(type: "int", nullable: true),
                    Outcome = table.Column<int>(type: "int", nullable: false),
                    MatchEventProposalId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserMatchFights", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserMatchFights_RosterPlayers_RosterPlayerId",
                        column: x => x.RosterPlayerId,
                        principalTable: "RosterPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserMatchFights_UserMatches_UserMatchId",
                        column: x => x.UserMatchId,
                        principalTable: "UserMatches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchAssists_MatchEventId",
                table: "UserMatchAssists",
                column: "MatchEventId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchAssists_RosterPlayerId",
                table: "UserMatchAssists",
                column: "RosterPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchAssists_UserMatchGoalId",
                table: "UserMatchAssists",
                column: "UserMatchGoalId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchAssists_UserMatchId",
                table: "UserMatchAssists",
                column: "UserMatchId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchFights_RosterPlayerId",
                table: "UserMatchFights",
                column: "RosterPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_UserMatchFights_UserMatchId",
                table: "UserMatchFights",
                column: "UserMatchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserMatchAssists");

            migrationBuilder.DropTable(
                name: "UserMatchFights");

            migrationBuilder.DropColumn(
                name: "GameClock",
                table: "MatchEvents");

            migrationBuilder.DropColumn(
                name: "Period",
                table: "MatchEvents");

            migrationBuilder.DropColumn(
                name: "Assist1RosterPlayerId",
                table: "MatchEventProposals");

            migrationBuilder.DropColumn(
                name: "Assist1UserId",
                table: "MatchEventProposals");

            migrationBuilder.DropColumn(
                name: "Assist2RosterPlayerId",
                table: "MatchEventProposals");

            migrationBuilder.DropColumn(
                name: "Assist2UserId",
                table: "MatchEventProposals");

            migrationBuilder.DropColumn(
                name: "FightOutcome",
                table: "MatchEventProposals");
        }
    }
}
