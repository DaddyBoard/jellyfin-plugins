using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.SonarrPlaceholder.Models;

public class PatchRequestPayload
{
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}
