using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IntegrationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "attempts",
                table: "webhook_events",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "origin_postal_code",
                table: "sellers",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "phone",
                table: "sellers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "height_cm",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "hs_code",
                table: "products",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "length_cm",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "weight_grams",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "width_cm",
                table: "products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "last_refund_id",
                table: "payments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "refunded_amount",
                table: "payments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<DateTime>(
                name: "refunded_at",
                table: "payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "tracking_code",
                table: "orders",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "carrier",
                table: "orders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "coupon_code",
                table: "checkout_quotes",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "postal_code",
                table: "checkout_quotes",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_orders_tracking_code",
                table: "orders",
                column: "tracking_code");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_orders_tracking_code",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "attempts",
                table: "webhook_events");

            migrationBuilder.DropColumn(
                name: "origin_postal_code",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "phone",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "height_cm",
                table: "products");

            migrationBuilder.DropColumn(
                name: "hs_code",
                table: "products");

            migrationBuilder.DropColumn(
                name: "length_cm",
                table: "products");

            migrationBuilder.DropColumn(
                name: "weight_grams",
                table: "products");

            migrationBuilder.DropColumn(
                name: "width_cm",
                table: "products");

            migrationBuilder.DropColumn(
                name: "last_refund_id",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "refunded_amount",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "refunded_at",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "coupon_code",
                table: "checkout_quotes");

            migrationBuilder.DropColumn(
                name: "postal_code",
                table: "checkout_quotes");

            migrationBuilder.AlterColumn<string>(
                name: "tracking_code",
                table: "orders",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "carrier",
                table: "orders",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(80)",
                oldMaxLength: 80,
                oldNullable: true);
        }
    }
}
