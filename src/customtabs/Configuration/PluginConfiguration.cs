using System.Collections.Generic;
using MediaBrowser.Model.Plugins;

namespace CustomTabsJF12.Configuration;

public class PluginConfiguration : BasePluginConfiguration
{
    public List<CustomTab> Tabs { get; set; } = new List<CustomTab>();
}

public class CustomTab
{
    public string Title { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
}
