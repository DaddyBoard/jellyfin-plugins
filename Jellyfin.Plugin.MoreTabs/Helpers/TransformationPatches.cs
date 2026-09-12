using System;
using System.Reflection;
using Jellyfin.Plugin.MoreTabs.Models;

namespace Jellyfin.Plugin.MoreTabs.Helpers;

public static class TransformationPatches
{
    public static string IndexHtml(PatchRequestPayload payload)
    {
        return Apply(payload?.Contents);
    }

    public static string IndexHtml(object payload)
    {
        return Apply(ReadContents(payload));
    }

    private static string Apply(string? html)
    {
        string version = global::Jellyfin.Plugin.MoreTabs.Plugin.Instance?.Version.ToString() ?? "1";
        return IndexHtmlPatch.Apply(html ?? string.Empty, "../MoreTabs/client.js?v=" + version);
    }

    private static string ReadContents(object? payload)
    {
        if (payload is null)
        {
            return string.Empty;
        }

        if (payload is PatchRequestPayload typed)
        {
            return typed.Contents ?? string.Empty;
        }

        if (payload is string text)
        {
            return text;
        }

        PropertyInfo? property = payload.GetType().GetProperty("Contents")
            ?? payload.GetType().GetProperty("contents");
        return property?.GetValue(payload) as string ?? string.Empty;
    }
}
