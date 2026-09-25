using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.SonarrPlaceholder.Configuration;
using Jellyfin.Plugin.SonarrPlaceholder.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.SonarrPlaceholder.Services;

public class SonarrService
{
    private readonly ILogger<SonarrService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;

    public SonarrService(
        ILogger<SonarrService> logger,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache)
    {
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
    }

    public async Task<bool> TestConnectionAsync(string sonarrUrl, string apiKey)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(sonarrUrl) || string.IsNullOrWhiteSpace(apiKey))
            {
                return false;
            }

            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-Api-Key", apiKey);

            var url = $"{sonarrUrl.TrimEnd('/')}/api/v3/system/status";
            var response = await client.GetAsync(url).ConfigureAwait(false);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to test Sonarr connection");
            return false;
        }
    }

    public async Task<List<SonarrSeries>> GetAllSeriesAsync()
    {
        var config = Plugin.Instance?.Configuration;
        if (config is null || string.IsNullOrWhiteSpace(config.SonarrUrl) || string.IsNullOrWhiteSpace(config.SonarrApiKey))
        {
            return new List<SonarrSeries>();
        }

        var cacheKey = "sonarr_all_series";
        if (_cache.TryGetValue<List<SonarrSeries>>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-Api-Key", config.SonarrApiKey);
            client.Timeout = TimeSpan.FromSeconds(30);

            var url = $"{config.SonarrUrl.TrimEnd('/')}/api/v3/series";
            var response = await client.GetAsync(url).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Sonarr API returned status code {StatusCode}", response.StatusCode);
                return new List<SonarrSeries>();
            }

            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            var series = JsonSerializer.Deserialize<List<SonarrSeries>>(content) ?? new List<SonarrSeries>();

            var cacheExpiration = TimeSpan.FromMinutes(config.CacheDurationMinutes);
            _cache.Set(cacheKey, series, cacheExpiration);

            return series;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch series from Sonarr");
            return new List<SonarrSeries>();
        }
    }

    public async Task<SonarrSeries?> FindSeriesByProviderIdsAsync(int? tvdbId, string? imdbId)
    {
        var allSeries = await GetAllSeriesAsync().ConfigureAwait(false);

        if (tvdbId.HasValue && tvdbId.Value > 0)
        {
            var match = allSeries.FirstOrDefault(s => s.TvdbId == tvdbId.Value);
            if (match is not null)
            {
                return match;
            }
        }

        if (!string.IsNullOrWhiteSpace(imdbId))
        {
            var match = allSeries.FirstOrDefault(s =>
                !string.IsNullOrWhiteSpace(s.ImdbId) &&
                s.ImdbId.Equals(imdbId, StringComparison.OrdinalIgnoreCase));
            if (match is not null)
            {
                return match;
            }
        }

        return null;
    }

    public async Task<List<SonarrEpisode>> GetEpisodesAsync(int seriesId)
    {
        var config = Plugin.Instance?.Configuration;
        if (config is null || string.IsNullOrWhiteSpace(config.SonarrUrl) || string.IsNullOrWhiteSpace(config.SonarrApiKey))
        {
            return new List<SonarrEpisode>();
        }

        var cacheKey = $"sonarr_episodes_{seriesId}";
        if (_cache.TryGetValue<List<SonarrEpisode>>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("X-Api-Key", config.SonarrApiKey);
            client.Timeout = TimeSpan.FromSeconds(30);

            var url = $"{config.SonarrUrl.TrimEnd('/')}/api/v3/episode?seriesId={seriesId}";
            var response = await client.GetAsync(url).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Sonarr API returned status code {StatusCode} for series {SeriesId}", response.StatusCode, seriesId);
                return new List<SonarrEpisode>();
            }

            var content = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            var episodes = JsonSerializer.Deserialize<List<SonarrEpisode>>(content) ?? new List<SonarrEpisode>();

            var cacheExpiration = TimeSpan.FromMinutes(config.CacheDurationMinutes);
            _cache.Set(cacheKey, episodes, cacheExpiration);

            return episodes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch episodes from Sonarr for series {SeriesId}", seriesId);
            return new List<SonarrEpisode>();
        }
    }

    public async Task<List<PlaceholderEpisode>> GetMissingEpisodesAsync(int? tvdbId, string? imdbId, int? seasonNumber = null)
    {
        var config = Plugin.Instance?.Configuration;
        if (config is null || !config.Enabled)
        {
            return new List<PlaceholderEpisode>();
        }

        var series = await FindSeriesByProviderIdsAsync(tvdbId, imdbId).ConfigureAwait(false);
        if (series is null)
        {
            return new List<PlaceholderEpisode>();
        }

        var allEpisodes = await GetEpisodesAsync(series.Id).ConfigureAwait(false);
        var now = DateTime.UtcNow;
        var maxDate = now.AddDays(config.MaxDaysAhead);

        var missingEpisodes = allEpisodes
            .Where(e => !e.HasFile && e.Monitored)
            .Where(e => seasonNumber is null || e.SeasonNumber == seasonNumber)
            .Where(e =>
            {
                if (e.AirDateUtc.HasValue)
                {
                    var hasAired = e.AirDateUtc.Value <= now;
                    if (hasAired && !config.ShowAiredButMissing)
                    {
                        return false;
                    }
                    if (!hasAired && !config.ShowUnairedEpisodes)
                    {
                        return false;
                    }
                    if (!hasAired && e.AirDateUtc.Value > maxDate)
                    {
                        return false;
                    }
                }
                return true;
            })
            .Select(e => new PlaceholderEpisode
            {
                EpisodeNumber = e.EpisodeNumber,
                SeasonNumber = e.SeasonNumber,
                Title = e.Title,
                AirDate = e.AirDate,
                AirDateUtc = e.AirDateUtc,
                Overview = e.Overview,
                HasAired = e.AirDateUtc.HasValue && e.AirDateUtc.Value <= now,
                AbsoluteEpisodeNumber = e.AbsoluteEpisodeNumber
            })
            .OrderBy(e => e.SeasonNumber)
            .ThenBy(e => e.EpisodeNumber)
            .ToList();

        return missingEpisodes;
    }
}
