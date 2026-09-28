using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Marketplace.Api.Infrastructure;

public static class JsonSetup
{
    /// <summary>camelCase, enums como string, datas ISO 8601 UTC com sufixo Z, nulls presentes.</summary>
    public static JsonSerializerOptions Configure(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.DictionaryKeyPolicy = null;
        options.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
        options.PropertyNameCaseInsensitive = true;
        options.NumberHandling = JsonNumberHandling.AllowReadingFromString;
        options.Converters.Add(new JsonStringEnumConverter());
        options.Converters.Add(new UtcDateTimeConverter());
        options.Converters.Add(new NullableUtcDateTimeConverter());
        return options;
    }

    public static JsonSerializerOptions Create() => Configure(new JsonSerializerOptions(JsonSerializerDefaults.Web));

    public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
    {
        private const string Format = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'";

        public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            var value = reader.GetDateTime();
            return value.Kind == DateTimeKind.Utc ? value : value.ToUniversalTime();
        }

        public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options) =>
            writer.WriteStringValue((value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc)).ToString(Format, CultureInfo.InvariantCulture));
    }

    public sealed class NullableUtcDateTimeConverter : JsonConverter<DateTime?>
    {
        private static readonly UtcDateTimeConverter Inner = new();

        public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.TokenType == JsonTokenType.Null ? null : Inner.Read(ref reader, typeof(DateTime), options);

        public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
        {
            if (value is null) writer.WriteNullValue();
            else Inner.Write(writer, value.Value, options);
        }
    }
}
