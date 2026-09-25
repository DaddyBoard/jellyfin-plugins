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
    public const string PluginGuid = "e5c63724-9d4b-469e-87d5-e6410462109a";

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
