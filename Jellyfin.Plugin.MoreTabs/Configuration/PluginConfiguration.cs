using System.Collections.Generic;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.MoreTabs.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public List<TabConfig> Tabs { get; set; } = new List<TabConfig>();
}

public class TabConfig
{
    public string Id { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;

    public string Icon { get; set; } = string.Empty;

    public bool Enabled { get; set; } = true;
}
