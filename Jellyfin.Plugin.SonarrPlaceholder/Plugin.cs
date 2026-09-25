using System;
using System.Collections.Generic;
using Jellyfin.Plugin.SonarrPlaceholder.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.SonarrPlaceholder;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public const string PluginGuid = "a7f8c2e1-3d4b-5c6a-7e8f-9a0b1c2d3e4f";

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "Sonarr Placeholder";

    public override string Description => "Show placeholder episode cards for unaired/missing episodes tracked by Sonarr";

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
                MenuIcon = "movie"
            },
            new PluginPageInfo
            {
                Name = Name + ".js",
                EmbeddedResourcePath = prefix + ".Configuration.config.js"
            }
        ];
    }
}
