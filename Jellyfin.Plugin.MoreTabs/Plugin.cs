using System;
using System.Collections.Generic;
using Jellyfin.Plugin.MoreTabs.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.MoreTabs;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public const string PluginGuid = "9f3c2a71-6d84-4b1e-9e2a-1c8f0d5a7b33";

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "MoreTabs";

    public override string Description => "Add extra navbar items that open iframe pages";

    public override Guid Id => Guid.Parse(PluginGuid);

    public IEnumerable<PluginPageInfo> GetPages()
    {
        string prefix = GetType().Namespace!;
        return
        [
            new PluginPageInfo
            {
                Name = Name,
                DisplayName = Name,
                EmbeddedResourcePath = prefix + ".Configuration.config.html",
                EnableInMainMenu = false,
                MenuIcon = "tab"
            },
            new PluginPageInfo
            {
                Name = Name + ".js",
                EmbeddedResourcePath = prefix + ".Configuration.config.js"
            }
        ];
    }
}
