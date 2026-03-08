using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddUserSeasonAggregatedDataAndCleanupUserMatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Create UserSeasonAggregatedData table
            migrationBuilder.CreateTable(
                name: "UserSeasonAggregatedData",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false),
                    UserId = table.Column<int>(nullable: false),
                    SeasonId = table.Column<int>(nullable: false),
                    TotalPlus = table.Column<int>(nullable: false),
                    TotalMinus = table.Column<int>(nullable: false),
                    MatchesPlayed = table.Column<int>(nullable: false),
                    CreatedAt = table.Column<DateTime>(nullable: false),
                    UpdatedAt = table.Column<DateTime>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserSeasonAggregatedData", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserSeasonAggregatedData_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserSeasonAggregatedData_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserSeasonAggregatedData_UserId_SeasonId",
                table: "UserSeasonAggregatedData",
                columns: new[] { "UserId", "SeasonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserSeasonAggregatedData_SeasonId",
                table: "UserSeasonAggregatedData",
                column: "SeasonId");

            // 2. Delete legacy aggregated UserMatch rows (where MatchId IS NULL)
            migrationBuilder.Sql("DELETE FROM UserMatches WHERE MatchId IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop UserSeasonAggregatedData table
            migrationBuilder.DropTable(
                name: "UserSeasonAggregatedData");
        }
    }
}
