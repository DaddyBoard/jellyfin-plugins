using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.SonarrPlaceholder.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public string SonarrUrl { get; set; } = string.Empty;

    public string SonarrApiKey { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;

    public bool ShowAiredButMissing { get; set; } = true;

    public bool ShowUnairedEpisodes { get; set; } = true;

    public int MaxDaysAhead { get; set; } = 365;

    public int CacheDurationMinutes { get; set; } = 5;
}
