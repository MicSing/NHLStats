using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class SyncNeutralOffsideIcingSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No-op: PointReasons 21/22 (Neutral Offside/Icing) were already inserted by
            // 20260610115537_AddNeutralOffsideAndIcing. That migration's HasData() was never
            // added to NhlStatsDbContext's OnModelCreating seed array, so the EF model snapshot
            // diverged from the actual schema and started scaffolding a duplicate insert. This
            // migration exists only to bring the snapshot back in sync with reality.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
