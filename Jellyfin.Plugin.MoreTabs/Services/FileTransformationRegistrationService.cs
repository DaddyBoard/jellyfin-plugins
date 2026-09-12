using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.MoreTabs.Services;

public class FileTransformationRegistrationService : IHostedService
{
    public static readonly Guid TransformationId = Guid.Parse("6e1b0c4a-2f8d-4a91-9c3e-7d5b1a8e4f02");
    public static readonly Guid TransformationRegexId = Guid.Parse("6e1b0c4a-2f8d-4a91-9c3e-7d5b1a8e4f03");

    private readonly ILogger<FileTransformationRegistrationService> _logger;

    public FileTransformationRegistrationService(ILogger<FileTransformationRegistrationService> logger)
    {
        _logger = logger;
    }

    public static bool IsRegistered { get; private set; }

    public static string? LastError { get; private set; }

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

        LastError ??= "File Transformation was not found after startup retries";
        _logger.LogWarning("MoreTabs: File Transformation 3.0 was not found. Built-in index.html injection will be used instead");
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            Type? pluginInterfaceType = FindAssembly()?.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
            MethodInfo? remove = pluginInterfaceType?.GetMethod("RemoveTransformation");
            remove?.Invoke(null, new object?[] { TransformationId });
            remove?.Invoke(null, new object?[] { TransformationRegexId });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MoreTabs failed to unregister File Transformation");
        }

        IsRegistered = false;
        return Task.CompletedTask;
    }

    private bool TryRegister()
    {
        try
        {
            Assembly? fileTransformationAssembly = FindAssembly();
            if (fileTransformationAssembly is null)
            {
                return false;
            }

            Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
            if (pluginInterfaceType is null)
            {
                LastError = "File Transformation PluginInterface type is missing";
                _logger.LogWarning("MoreTabs: {Error}", LastError);
                return false;
            }

            MethodInfo? register = pluginInterfaceType.GetMethod("RegisterTransformation");
            if (register is null)
            {
                LastError = "File Transformation RegisterTransformation method is missing";
                _logger.LogWarning("MoreTabs: {Error}", LastError);
                return false;
            }

            object? exact = CreatePayload(fileTransformationAssembly, TransformationId, "index.html");
            object? regex = CreatePayload(fileTransformationAssembly, TransformationRegexId, @"index\.html$");
            if (exact is null || regex is null)
            {
                LastError = "Could not construct a File Transformation JObject payload";
                _logger.LogWarning("MoreTabs: {Error}", LastError);
                return false;
            }

            register.Invoke(null, new object?[] { exact });
            register.Invoke(null, new object?[] { regex });
            IsRegistered = true;
            LastError = null;
            _logger.LogInformation("MoreTabs registered index.html with File Transformation 3.0 via HTTP callback");
            return true;
        }
        catch (Exception ex)
        {
            LastError = ex.GetBaseException().Message;
            _logger.LogWarning(ex, "MoreTabs File Transformation registration failed");
            return false;
        }
    }

    private static object? CreatePayload(Assembly fileTransformationAssembly, Guid id, string fileNamePattern)
    {
        Assembly? newtonsoft = FindNewtonsoft(fileTransformationAssembly);
        Type? jObjectType = newtonsoft?.GetType("Newtonsoft.Json.Linq.JObject");
        MethodInfo? parse = jObjectType?.GetMethod("Parse", [typeof(string)]);
        if (parse is null)
        {
            return null;
        }

        Dictionary<string, string> values = new Dictionary<string, string>
        {
            ["id"] = id.ToString(),
            ["fileNamePattern"] = fileNamePattern,
            ["transformationEndpoint"] = "/MoreTabs/TransformIndexHtml"
        };

        return parse.Invoke(null, [JsonSerializer.Serialize(values)]);
    }

    private static Assembly? FindNewtonsoft(Assembly fileTransformationAssembly)
    {
        AssemblyLoadContext? context = AssemblyLoadContext.All
            .FirstOrDefault(alc => alc.Assemblies.Contains(fileTransformationAssembly));
        Assembly? fromContext = context?.Assemblies
            .FirstOrDefault(static assembly => string.Equals(assembly.GetName().Name, "Newtonsoft.Json", StringComparison.Ordinal));
        if (fromContext is not null)
        {
            return fromContext;
        }

        return AssemblyLoadContext.All
            .SelectMany(static alc => alc.Assemblies)
            .FirstOrDefault(static assembly => string.Equals(assembly.GetName().Name, "Newtonsoft.Json", StringComparison.Ordinal));
    }

    private static Assembly? FindAssembly()
    {
        return AssemblyLoadContext.All
            .SelectMany(static x => x.Assemblies)
            .FirstOrDefault(static x => x.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) ?? false);
    }
}
