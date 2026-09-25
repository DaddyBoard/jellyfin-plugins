using Jellyfin.Plugin.SonarrPlaceholder.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.SonarrPlaceholder;

public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddMemoryCache();
        serviceCollection.AddHttpClient();
        serviceCollection.AddScoped<SonarrService>();
        serviceCollection.AddHostedService<FileTransformationRegistrationService>();
    }
}
