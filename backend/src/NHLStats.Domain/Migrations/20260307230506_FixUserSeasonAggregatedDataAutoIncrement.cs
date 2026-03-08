using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class FixUserSeasonAggregatedDataAutoIncrement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SQLite doesn't support ALTER TABLE to add AUTOINCREMENT
            // We need to recreate the table with the correct schema

            // 1. Create backup table with existing data (if any)
            migrationBuilder.Sql(@"
                CREATE TABLE UserSeasonAggregatedData_Backup AS 
                SELECT * FROM UserSeasonAggregatedData;
            ");

            // 2. Drop the original table
            migrationBuilder.DropTable(name: "UserSeasonAggregatedData");

            // 3. Recreate table with AUTOINCREMENT
            migrationBuilder.CreateTable(
                name: "UserSeasonAggregatedData",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    SeasonId = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalPlus = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalMinus = table.Column<int>(type: "INTEGER", nullable: false),
                    MatchesPlayed = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
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

            // 4. Restore data from backup (if there was any)
            migrationBuilder.Sql(@"
                INSERT INTO UserSeasonAggregatedData (Id, UserId, SeasonId, TotalPlus, TotalMinus, MatchesPlayed, CreatedAt, UpdatedAt)
                SELECT Id, UserId, SeasonId, TotalPlus, TotalMinus, MatchesPlayed, CreatedAt, UpdatedAt
                FROM UserSeasonAggregatedData_Backup;
            ");

            // 5. Drop backup table
            migrationBuilder.Sql("DROP TABLE UserSeasonAggregatedData_Backup;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverting would recreate the table without autoincrement
            migrationBuilder.Sql(@"
                CREATE TABLE UserSeasonAggregatedData_Backup AS 
                SELECT * FROM UserSeasonAggregatedData;
            ");

            migrationBuilder.DropTable(name: "UserSeasonAggregatedData");

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

            migrationBuilder.Sql(@"
                INSERT INTO UserSeasonAggregatedData (Id, UserId, SeasonId, TotalPlus, TotalMinus, MatchesPlayed, CreatedAt, UpdatedAt)
                SELECT Id, UserId, SeasonId, TotalPlus, TotalMinus, MatchesPlayed, CreatedAt, UpdatedAt
                FROM UserSeasonAggregatedData_Backup;
            ");

            migrationBuilder.Sql("DROP TABLE UserSeasonAggregatedData_Backup;");
        }
    }
}
