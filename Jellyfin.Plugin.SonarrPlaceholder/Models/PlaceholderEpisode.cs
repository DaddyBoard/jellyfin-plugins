using System;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.SonarrPlaceholder.Models;

public class PlaceholderEpisode
{
    [JsonPropertyName("episodeNumber")]
    public int EpisodeNumber { get; set; }

    [JsonPropertyName("seasonNumber")]
    public int SeasonNumber { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("airDate")]
    public string? AirDate { get; set; }

    [JsonPropertyName("airDateUtc")]
    public DateTime? AirDateUtc { get; set; }

    [JsonPropertyName("overview")]
    public string? Overview { get; set; }

    [JsonPropertyName("hasAired")]
    public bool HasAired { get; set; }

    [JsonPropertyName("absoluteEpisodeNumber")]
    public int? AbsoluteEpisodeNumber { get; set; }
}
