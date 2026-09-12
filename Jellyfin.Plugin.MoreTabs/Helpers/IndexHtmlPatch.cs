using System;

namespace Jellyfin.Plugin.MoreTabs.Helpers;

public static class IndexHtmlPatch
{
    public const string Marker = "/MoreTabs/client.js";

    public static string Apply(string html, string scriptSrc)
    {
        if (string.IsNullOrEmpty(html) || html.IndexOf(Marker, StringComparison.OrdinalIgnoreCase) >= 0)
        {
            return html;
        }

        int bodyClose = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        string tag = "<script src=\"" + scriptSrc + "\" defer></script>";
        if (bodyClose >= 0)
        {
            return html.Substring(0, bodyClose) + tag + "\n" + html.Substring(bodyClose);
        }

        return html + tag;
    }
}
