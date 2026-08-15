using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class UnifyRosterPlayers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SeasonRosterPlayers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeasonId = table.Column<int>(type: "int", nullable: false),
                    RosterPlayerId = table.Column<int>(type: "int", nullable: false),
                    TeamId = table.Column<int>(type: "int", nullable: false),
                    Position = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonRosterPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonRosterPlayers_RosterPlayers_RosterPlayerId",
                        column: x => x.RosterPlayerId,
                        principalTable: "RosterPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeasonRosterPlayers_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeasonRosterPlayers_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            // Populate SeasonRosterPlayers from existing RosterPlayers before dropping columns
            migrationBuilder.Sql(@"
                INSERT INTO SeasonRosterPlayers (SeasonId, RosterPlayerId, TeamId, Position, IsActive)
                SELECT SeasonId, Id, TeamId, Position, IsActive
                FROM RosterPlayers;
            ");

            // Deduplicate RosterPlayers by name across seasons
            migrationBuilder.Sql(@"
                DECLARE @DupMap TABLE (DuplicateId INT, CanonicalId INT);

                INSERT INTO @DupMap (DuplicateId, CanonicalId)
                SELECT rp.Id, canon.MinId
                FROM RosterPlayers rp
                INNER JOIN (
                    SELECT LOWER(LTRIM(RTRIM(FirstName))) AS FName, LOWER(LTRIM(RTRIM(Surname))) AS SName, MIN(Id) AS MinId
                    FROM RosterPlayers
                    GROUP BY LOWER(LTRIM(RTRIM(FirstName))), LOWER(LTRIM(RTRIM(Surname)))
                ) canon ON LOWER(LTRIM(RTRIM(rp.FirstName))) = canon.FName AND LOWER(LTRIM(RTRIM(rp.Surname))) = canon.SName
                WHERE rp.Id <> canon.MinId;

                -- Update UserMatchGoals
                UPDATE g
                SET g.RosterPlayerId = d.CanonicalId
                FROM UserMatchGoals g
                INNER JOIN @DupMap d ON g.RosterPlayerId = d.DuplicateId;

                -- Update UserMatchPenalties
                UPDATE p
                SET p.RosterPlayerId = d.CanonicalId
                FROM UserMatchPenalties p
                INNER JOIN @DupMap d ON p.RosterPlayerId = d.DuplicateId;

                -- For SeasonRosterPlayers: remove rows that would cause duplicates when repointing
                DELETE srp
                FROM SeasonRosterPlayers srp
                INNER JOIN @DupMap d ON srp.RosterPlayerId = d.DuplicateId
                WHERE EXISTS (
                    SELECT 1 FROM SeasonRosterPlayers srp2
                    WHERE srp2.SeasonId = srp.SeasonId AND srp2.RosterPlayerId = d.CanonicalId
                );

                -- Repoint remaining SeasonRosterPlayers
                UPDATE srp
                SET srp.RosterPlayerId = d.CanonicalId
                FROM SeasonRosterPlayers srp
                INNER JOIN @DupMap d ON srp.RosterPlayerId = d.DuplicateId;

                -- Delete duplicate RosterPlayers
                DELETE rp
                FROM RosterPlayers rp
                INNER JOIN @DupMap d ON rp.Id = d.DuplicateId;
            ");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRosterPlayers_RosterPlayerId",
                table: "SeasonRosterPlayers",
                column: "RosterPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRosterPlayers_SeasonId_RosterPlayerId",
                table: "SeasonRosterPlayers",
                columns: new[] { "SeasonId", "RosterPlayerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRosterPlayers_TeamId",
                table: "SeasonRosterPlayers",
                column: "TeamId");

            migrationBuilder.DropForeignKey(
                name: "FK_RosterPlayers_Seasons_SeasonId",
                table: "RosterPlayers");

            migrationBuilder.DropForeignKey(
                name: "FK_RosterPlayers_Teams_TeamId",
                table: "RosterPlayers");

            migrationBuilder.DropIndex(
                name: "IX_RosterPlayers_SeasonId",
                table: "RosterPlayers");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "RosterPlayers");

            migrationBuilder.DropColumn(
                name: "SeasonId",
                table: "RosterPlayers");

            migrationBuilder.AddForeignKey(
                name: "FK_RosterPlayers_Teams_TeamId",
                table: "RosterPlayers",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RosterPlayers_Teams_TeamId",
                table: "RosterPlayers");

            migrationBuilder.DropTable(
                name: "SeasonRosterPlayers");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "RosterPlayers",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "SeasonId",
                table: "RosterPlayers",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_RosterPlayers_SeasonId",
                table: "RosterPlayers",
                column: "SeasonId");

            migrationBuilder.AddForeignKey(
                name: "FK_RosterPlayers_Seasons_SeasonId",
                table: "RosterPlayers",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_RosterPlayers_Teams_TeamId",
                table: "RosterPlayers",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
