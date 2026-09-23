using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MatchEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MatchId = table.Column<int>(type: "int", nullable: false),
                    OrderIndex = table.Column<int>(type: "int", nullable: false),
                    EventType = table.Column<int>(type: "int", nullable: false),
                    IsOpponent = table.Column<bool>(type: "bit", nullable: false),
                    EventSubtype = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UserMatchGoalId = table.Column<int>(type: "int", nullable: true),
                    UserMatchPenaltyId = table.Column<int>(type: "int", nullable: true),
                    UserMatchPointId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatchEvents_Matches_MatchId",
                        column: x => x.MatchId,
                        principalTable: "Matches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MatchEvents_UserMatchGoals_UserMatchGoalId",
                        column: x => x.UserMatchGoalId,
                        principalTable: "UserMatchGoals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MatchEvents_UserMatchPenalties_UserMatchPenaltyId",
                        column: x => x.UserMatchPenaltyId,
                        principalTable: "UserMatchPenalties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MatchEvents_UserMatchPoints_UserMatchPointId",
                        column: x => x.UserMatchPointId,
                        principalTable: "UserMatchPoints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MatchEvents_MatchId_OrderIndex",
                table: "MatchEvents",
                columns: new[] { "MatchId", "OrderIndex" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MatchEvents_UserMatchGoalId",
                table: "MatchEvents",
                column: "UserMatchGoalId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchEvents_UserMatchPenaltyId",
                table: "MatchEvents",
                column: "UserMatchPenaltyId");

            migrationBuilder.CreateIndex(
                name: "IX_MatchEvents_UserMatchPointId",
                table: "MatchEvents",
                column: "UserMatchPointId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MatchEvents");
        }
    }
}
