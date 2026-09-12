using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Jellyfin.Plugin.MoreTabs.Helpers;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.MoreTabs.Services;

public class ScriptInjectionStartupFilter : IStartupFilter
{
    private readonly ILogger<ScriptInjectionStartupFilter> _logger;
    private int _loggedOnce;

    public ScriptInjectionStartupFilter(ILogger<ScriptInjectionStartupFilter> logger)
    {
        _logger = logger;
    }

    public static string? LastPath { get; private set; }

    public static int LastHtmlLength { get; private set; }

    public static bool LastApplied { get; private set; }

    public static string? LastSkipReason { get; private set; }

    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.Use(InvokeAsync);
            next(app);
        };
    }

    private async Task InvokeAsync(HttpContext context, Func<Task> nextMw)
    {
        if (!IsIndexRequest(context.Request.Path.Value) || !HttpMethods.IsGet(context.Request.Method))
        {
            await nextMw().ConfigureAwait(false);
            return;
        }

        LastPath = context.Request.Path.Value;
        LastApplied = false;
        LastSkipReason = null;

        context.Request.Headers.Remove("Accept-Encoding");
        context.Request.Headers.Remove("Range");
        context.Request.Headers.Remove("If-Range");

        Stream originalBody = context.Response.Body;
        IHttpResponseBodyFeature? originalFeature = context.Features.Get<IHttpResponseBodyFeature>();
        using MemoryStream buffer = new MemoryStream();
        context.Features.Set<IHttpResponseBodyFeature>(new StreamResponseBodyFeature(buffer));
        context.Response.Body = buffer;
        try
        {
            await nextMw().ConfigureAwait(false);
        }
        catch
        {
            context.Response.Body = originalBody;
            if (originalFeature is not null)
            {
                context.Features.Set(originalFeature);
            }

            throw;
        }

        context.Response.Body = originalBody;
        if (originalFeature is not null)
        {
            context.Features.Set(originalFeature);
        }

        buffer.Seek(0, SeekOrigin.Begin);
        LastHtmlLength = (int)buffer.Length;

        bool isHtml = context.Response.StatusCode == 200
            && ((context.Response.ContentType?.Contains("text/html", StringComparison.OrdinalIgnoreCase) ?? false)
                || LooksLikeHtml(buffer));

        if (!isHtml)
        {
            LastSkipReason = "status=" + context.Response.StatusCode
                + " type=" + (context.Response.ContentType ?? "none")
                + " len=" + buffer.Length;
            await buffer.CopyToAsync(originalBody).ConfigureAwait(false);
            return;
        }

        string html;
        using (StreamReader reader = new StreamReader(buffer, Encoding.UTF8, true, 1024, leaveOpen: true))
        {
            html = await reader.ReadToEndAsync().ConfigureAwait(false);
        }

        try
        {
            string pathBase = context.Request.PathBase.Value?.TrimEnd('/') ?? string.Empty;
            string version = global::Jellyfin.Plugin.MoreTabs.Plugin.Instance?.Version.ToString() ?? "1";
            string src = pathBase + "/MoreTabs/client.js?v=" + version;
            string patched = IndexHtmlPatch.Apply(html, src);
            LastApplied = !ReferenceEquals(patched, html) && patched.IndexOf(IndexHtmlPatch.Marker, StringComparison.OrdinalIgnoreCase) >= 0;
            html = patched;
            if (LastApplied && System.Threading.Interlocked.Exchange(ref _loggedOnce, 1) == 0)
            {
                _logger.LogInformation("MoreTabs injected client script into index.html");
            }

            if (!LastApplied && html.IndexOf(IndexHtmlPatch.Marker, StringComparison.OrdinalIgnoreCase) >= 0)
            {
                LastSkipReason = "already-present";
            }
            else if (!LastApplied)
            {
                LastSkipReason = "patch-unchanged len=" + html.Length;
            }
        }
        catch (Exception ex)
        {
            LastSkipReason = ex.GetBaseException().Message;
            _logger.LogWarning(ex, "MoreTabs script injection failed; serving original HTML");
        }

        byte[] bytes = Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html;charset=utf-8";
        context.Response.ContentLength = bytes.Length;
        context.Response.Headers.Remove("ETag");
        context.Response.Headers.Remove("Last-Modified");
        context.Response.Headers.Remove("Accept-Ranges");
        context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        await originalBody.WriteAsync(bytes).ConfigureAwait(false);
    }

    private static bool LooksLikeHtml(MemoryStream buffer)
    {
        if (buffer.Length < 15)
        {
            return false;
        }

        long position = buffer.Position;
        buffer.Seek(0, SeekOrigin.Begin);
        Span<byte> head = stackalloc byte[15];
        int read = buffer.Read(head);
        buffer.Seek(position, SeekOrigin.Begin);
        if (read < 15)
        {
            return false;
        }

        string prefix = Encoding.UTF8.GetString(head);
        return prefix.Contains("<!DOCTYPE", StringComparison.OrdinalIgnoreCase)
            || prefix.Contains("<html", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsIndexRequest(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return false;
        }

        return path.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/web", StringComparison.OrdinalIgnoreCase);
    }
}
