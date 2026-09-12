using System;

namespace Jellyfin.Plugin.MoreTabs.Helpers;

public static class IndexHtmlPatch
{
    public const string Marker = "/MoreTabs/client.js";

    public static string Apply(string html, string scriptSrc)
    {
        if (string.IsNullOrEmpty(html) || html.Contains(Marker, StringComparison.OrdinalIgnoreCase))
        {
            return html;
        }

        int bodyClose = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        string tag = string.Concat("<script src=\"", scriptSrc, "\" defer></script>");
        if (bodyClose >= 0)
        {
            return string.Concat(html.AsSpan(0, bodyClose), tag, "\n", html.AsSpan(bodyClose));
        }

        return string.Concat(html, tag);
    }
}
