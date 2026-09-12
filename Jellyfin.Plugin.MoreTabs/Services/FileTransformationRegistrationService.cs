using System;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.MoreTabs.Helpers;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.MoreTabs.Services;

public class FileTransformationRegistrationService : IHostedService
{
    public static readonly Guid TransformationId = Guid.Parse("6e1b0c4a-2f8d-4a91-9c3e-7d5b1a8e4f02");

    private readonly ILogger<FileTransformationRegistrationService> _logger;

    public FileTransformationRegistrationService(ILogger<FileTransformationRegistrationService> logger)
    {
        _logger = logger;
    }

    public static bool IsRegistered { get; private set; }

    public static bool IsAssemblyLoaded()
    {
        return FindAssembly() is not null;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        for (int attempt = 1; attempt <= 20; attempt++)
        {
            if (TryRegister())
            {
                return;
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken).ConfigureAwait(false);
        }

        _logger.LogWarning("MoreTabs: File Transformation 3.0 was not found. Built-in index.html injection will be used instead");
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        Type? pluginInterfaceType = FindAssembly()?.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
        pluginInterfaceType?.GetMethod("RemoveTransformation")?.Invoke(null, new object?[] { TransformationId });
        IsRegistered = false;
        return Task.CompletedTask;
    }

    private bool TryRegister()
    {
        Assembly? fileTransformationAssembly = FindAssembly();
        if (fileTransformationAssembly is null)
        {
            return false;
        }

        Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
        if (pluginInterfaceType is null)
        {
            _logger.LogWarning("MoreTabs: File Transformation assembly found but PluginInterface is missing");
            return false;
        }

        MethodInfo? register = pluginInterfaceType.GetMethod("RegisterTransformation");
        if (register is null)
        {
            _logger.LogWarning("MoreTabs: File Transformation PluginInterface.RegisterTransformation is missing");
            return false;
        }

        JObject payload = new JObject
        {
            ["id"] = TransformationId,
            ["fileNamePattern"] = @"index\.html$",
            ["callbackAssembly"] = typeof(TransformationPatches).Assembly.FullName,
            ["callbackClass"] = typeof(TransformationPatches).FullName,
            ["callbackMethod"] = nameof(TransformationPatches.IndexHtml)
        };

        register.Invoke(null, new object?[] { payload });
        IsRegistered = true;
        _logger.LogInformation("MoreTabs registered index.html with File Transformation 3.0");
        return true;
    }

    private static Assembly? FindAssembly()
    {
        return AssemblyLoadContext.All
            .SelectMany(static x => x.Assemblies)
            .FirstOrDefault(static x => x.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) ?? false);
    }
}
