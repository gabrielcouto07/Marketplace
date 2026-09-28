using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserBlocking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "blocked_at",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "blocked_reason",
                table: "users",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "blocked_at",
                table: "users");

            migrationBuilder.DropColumn(
                name: "blocked_reason",
                table: "users");
        }
    }
}
