using System;

namespace Jellyfin.Plugin.SonarrPlaceholder.Helpers;

public static class IndexHtmlPatch
{
    public const string Marker = "/SonarrPlaceholder/client.js";

    public static string Apply(string html, string scriptSrc)
    {
        if (string.IsNullOrEmpty(html) || html.Contains(Marker, StringComparison.OrdinalIgnoreCase) || !LooksLikeIndexHtml(html))
        {
            return html;
        }

        int bodyClose = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (bodyClose < 0)
        {
            return html;
        }

        string tag = string.Concat("<script src=\"", scriptSrc, "\" defer></script>");
        return string.Concat(html.AsSpan(0, bodyClose), tag, "\n", html.AsSpan(bodyClose));
    }

    private static bool LooksLikeIndexHtml(string html)
    {
        string start = html.TrimStart();
        return (start.StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase)
                || start.StartsWith("<html", StringComparison.OrdinalIgnoreCase))
            && html.Contains("</body>", StringComparison.OrdinalIgnoreCase);
    }
}
