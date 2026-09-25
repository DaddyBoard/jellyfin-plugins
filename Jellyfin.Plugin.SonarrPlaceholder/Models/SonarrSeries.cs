using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.SonarrPlaceholder.Models;

public class SonarrSeries
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("tvdbId")]
    public int TvdbId { get; set; }

    [JsonPropertyName("imdbId")]
    public string? ImdbId { get; set; }

    [JsonPropertyName("seasons")]
    public List<SonarrSeason> Seasons { get; set; } = new();
}

public class SonarrSeason
{
    [JsonPropertyName("seasonNumber")]
    public int SeasonNumber { get; set; }

    [JsonPropertyName("monitored")]
    public bool Monitored { get; set; }

    [JsonPropertyName("statistics")]
    public SonarrSeasonStatistics? Statistics { get; set; }
}

public class SonarrSeasonStatistics
{
    [JsonPropertyName("episodeCount")]
    public int EpisodeCount { get; set; }

    [JsonPropertyName("episodeFileCount")]
    public int EpisodeFileCount { get; set; }

    [JsonPropertyName("totalEpisodeCount")]
    public int TotalEpisodeCount { get; set; }
}
