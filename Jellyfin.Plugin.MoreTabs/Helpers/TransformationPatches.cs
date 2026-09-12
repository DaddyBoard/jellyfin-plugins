using Jellyfin.Plugin.MoreTabs.Models;

namespace Jellyfin.Plugin.MoreTabs.Helpers;

public static class TransformationPatches
{
    public static string IndexHtml(PatchRequestPayload payload)
    {
        string html = payload.Contents ?? string.Empty;
        string version = global::Jellyfin.Plugin.MoreTabs.Plugin.Instance?.Version.ToString() ?? "1";
        return IndexHtmlPatch.Apply(html, "../MoreTabs/client.js?v=" + version);
    }
}
