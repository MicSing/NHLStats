using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddApiKeysAndEventProposals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ApiKeys",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Prefix = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    KeyHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApiKeys", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MatchEventProposals",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MatchId = table.Column<int>(type: "int", nullable: false),
                    ApiKeyId = table.Column<int>(type: "int", nullable: false),
                    ClientEventId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    EventType = table.Column<int>(type: "int", nullable: false),
                    IsOpponent = table.Column<bool>(type: "bit", nullable: false),
                    EventSubtype = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    GoalType = table.Column<int>(type: "int", nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    RosterPlayerId = table.Column<int>(type: "int", nullable: true),
                    Period = table.Column<int>(type: "int", nullable: true),
                    GameClock = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    Strength = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: true),
                    Confidence = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MediaRef = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    MatchEventId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MatchEventProposals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MatchEventProposals_ApiKeys_ApiKeyId",
                        column: x => x.ApiKeyId,
                        principalTable: "ApiKeys",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MatchEventProposals_Matches_MatchId",
                        column: x => x.MatchId,
                        principalTable: "Matches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApiKeys_KeyHash",
                table: "ApiKeys",
                column: "KeyHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MatchEventProposals_ApiKeyId_ClientEventId",
                table: "MatchEventProposals",
                columns: new[] { "ApiKeyId", "ClientEventId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MatchEventProposals_MatchId_Status",
                table: "MatchEventProposals",
                columns: new[] { "MatchId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MatchEventProposals");

            migrationBuilder.DropTable(
                name: "ApiKeys");
        }
    }
}
