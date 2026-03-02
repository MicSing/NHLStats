using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace NHLStats.Domain.Migrations.Sqlite
{
    /// <inheritdoc />
    public partial class InitialCreateSqlite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Users",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatchPoints",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatchPenalties",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatchGoals",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatches",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Teams",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "SeasonUsers",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Seasons",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "RosterPlayers",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "PointReasons",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "MoneyConfigs",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Matches",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Expenses",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.InsertData(
                table: "MoneyConfigs",
                columns: new[] { "Id", "EffectiveFrom", "NegativePointValue", "PositivePointValue" },
                values: new object[] { 1, new DateTime(2000, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), -0.50m, 0.25m });

            migrationBuilder.InsertData(
                table: "PointReasons",
                columns: new[] { "Id", "IsActive", "IsPositive", "Name" },
                values: new object[,]
                {
                    { 1, true, false, "Penalty" },
                    { 2, true, false, "Secondary Penalty" },
                    { 3, true, false, "Not Scoring A Goal" },
                    { 4, true, true, "Scoring 10 Goals" },
                    { 5, true, false, "Last Minute Action" },
                    { 6, true, false, "Own Goal" },
                    { 7, true, false, "Error In Defense" },
                    { 8, true, false, "Prediction" }
                });

            migrationBuilder.InsertData(
                table: "Teams",
                columns: new[] { "Id", "Name", "ShortName" },
                values: new object[,]
                {
                    { 1, "Anaheim Ducks", "ANA" },
                    { 2, "Arizona Coyotes", "ARI" },
                    { 3, "Boston Bruins", "BOS" },
                    { 4, "Buffalo Sabres", "BUF" },
                    { 5, "Calgary Flames", "CGY" },
                    { 6, "Carolina Hurricanes", "CAR" },
                    { 7, "Chicago Blackhawks", "CHI" },
                    { 8, "Colorado Avalanche", "COL" },
                    { 9, "Columbus Blue Jackets", "CBJ" },
                    { 10, "Dallas Stars", "DAL" },
                    { 11, "Detroit Red Wings", "DET" },
                    { 12, "Edmonton Oilers", "EDM" },
                    { 13, "Florida Panthers", "FLA" },
                    { 14, "Los Angeles Kings", "LAK" },
                    { 15, "Minnesota Wild", "MIN" },
                    { 16, "Montréal Canadiens", "MTL" },
                    { 17, "Nashville Predators", "NSH" },
                    { 18, "New Jersey Devils", "NJD" },
                    { 19, "New York Islanders", "NYI" },
                    { 20, "New York Rangers", "NYR" },
                    { 21, "Ottawa Senators", "OTT" },
                    { 22, "Philadelphia Flyers", "PHI" },
                    { 23, "Pittsburgh Penguins", "PIT" },
                    { 24, "San Jose Sharks", "SJS" },
                    { 25, "Seattle Kraken", "SEA" },
                    { 26, "St. Louis Blues", "STL" },
                    { 27, "Tampa Bay Lightning", "TBL" },
                    { 28, "Toronto Maple Leafs", "TOR" },
                    { 29, "Vancouver Canucks", "VAN" },
                    { 30, "Vegas Golden Knights", "VGK" },
                    { 31, "Washington Capitals", "WSH" },
                    { 32, "Winnipeg Jets", "WPG" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserMatches_SeasonId",
                table: "UserMatches",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonUsers_UserId",
                table: "SeasonUsers",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Matches_Seasons_SeasonId",
                table: "Matches",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Matches_Teams_AwayTeamId",
                table: "Matches",
                column: "AwayTeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Matches_Teams_HomeTeamId",
                table: "Matches",
                column: "HomeTeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

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

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Seasons_ParentSeasonId",
                table: "Seasons",
                column: "ParentSeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Seasons_Teams_HostedTeamId",
                table: "Seasons",
                column: "HostedTeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SeasonUsers_Seasons_SeasonId",
                table: "SeasonUsers",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_SeasonUsers_Users_UserId",
                table: "SeasonUsers",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatches_Matches_MatchId",
                table: "UserMatches",
                column: "MatchId",
                principalTable: "Matches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatches_Seasons_SeasonId",
                table: "UserMatches",
                column: "SeasonId",
                principalTable: "Seasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatches_Users_UserId",
                table: "UserMatches",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatchGoals_RosterPlayers_RosterPlayerId",
                table: "UserMatchGoals",
                column: "RosterPlayerId",
                principalTable: "RosterPlayers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatchGoals_UserMatches_UserMatchId",
                table: "UserMatchGoals",
                column: "UserMatchId",
                principalTable: "UserMatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatchPenalties_RosterPlayers_RosterPlayerId",
                table: "UserMatchPenalties",
                column: "RosterPlayerId",
                principalTable: "RosterPlayers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatchPenalties_UserMatches_UserMatchId",
                table: "UserMatchPenalties",
                column: "UserMatchId",
                principalTable: "UserMatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatchPoints_PointReasons_PointReasonId",
                table: "UserMatchPoints",
                column: "PointReasonId",
                principalTable: "PointReasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserMatchPoints_UserMatches_UserMatchId",
                table: "UserMatchPoints",
                column: "UserMatchId",
                principalTable: "UserMatches",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Matches_Seasons_SeasonId",
                table: "Matches");

            migrationBuilder.DropForeignKey(
                name: "FK_Matches_Teams_AwayTeamId",
                table: "Matches");

            migrationBuilder.DropForeignKey(
                name: "FK_Matches_Teams_HomeTeamId",
                table: "Matches");

            migrationBuilder.DropForeignKey(
                name: "FK_RosterPlayers_Seasons_SeasonId",
                table: "RosterPlayers");

            migrationBuilder.DropForeignKey(
                name: "FK_RosterPlayers_Teams_TeamId",
                table: "RosterPlayers");

            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Seasons_ParentSeasonId",
                table: "Seasons");

            migrationBuilder.DropForeignKey(
                name: "FK_Seasons_Teams_HostedTeamId",
                table: "Seasons");

            migrationBuilder.DropForeignKey(
                name: "FK_SeasonUsers_Seasons_SeasonId",
                table: "SeasonUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_SeasonUsers_Users_UserId",
                table: "SeasonUsers");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatches_Matches_MatchId",
                table: "UserMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatches_Seasons_SeasonId",
                table: "UserMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatches_Users_UserId",
                table: "UserMatches");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatchGoals_RosterPlayers_RosterPlayerId",
                table: "UserMatchGoals");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatchGoals_UserMatches_UserMatchId",
                table: "UserMatchGoals");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatchPenalties_RosterPlayers_RosterPlayerId",
                table: "UserMatchPenalties");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatchPenalties_UserMatches_UserMatchId",
                table: "UserMatchPenalties");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatchPoints_PointReasons_PointReasonId",
                table: "UserMatchPoints");

            migrationBuilder.DropForeignKey(
                name: "FK_UserMatchPoints_UserMatches_UserMatchId",
                table: "UserMatchPoints");

            migrationBuilder.DropIndex(
                name: "IX_UserMatches_SeasonId",
                table: "UserMatches");

            migrationBuilder.DropIndex(
                name: "IX_SeasonUsers_UserId",
                table: "SeasonUsers");

            migrationBuilder.DeleteData(
                table: "MoneyConfigs",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 16);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 17);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 18);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 19);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 20);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 21);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 22);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 23);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 24);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 25);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 26);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 27);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 28);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 29);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 30);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 31);

            migrationBuilder.DeleteData(
                table: "Teams",
                keyColumn: "Id",
                keyValue: 32);

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Users",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatchPoints",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatchPenalties",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatchGoals",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "UserMatches",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Teams",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "SeasonUsers",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Seasons",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "RosterPlayers",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "PointReasons",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "MoneyConfigs",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Matches",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Expenses",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int")
                .OldAnnotation("SqlServer:Identity", "1, 1");
        }
    }
}
