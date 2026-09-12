using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Jellyfin.Plugin.MoreTabs.Configuration;
using Jellyfin.Plugin.MoreTabs.Helpers;
using Jellyfin.Plugin.MoreTabs.Models;
using Jellyfin.Plugin.MoreTabs.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.MoreTabs.Controllers;

[ApiController]
[Route("MoreTabs")]
public class MoreTabsController : ControllerBase
{
    [HttpGet("client.js")]
    [AllowAnonymous]
    public IActionResult GetClientScript()
    {
        Stream? stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("Jellyfin.Plugin.MoreTabs.Web.client.js");
        if (stream is null)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        return File(stream, "application/javascript");
    }

    [HttpPost("TransformIndexHtml")]
    [AllowAnonymous]
    public ContentResult TransformIndexHtml([FromBody] PatchRequestPayload? payload)
    {
        string version = global::Jellyfin.Plugin.MoreTabs.Plugin.Instance?.Version.ToString() ?? "1";
        string html = IndexHtmlPatch.Apply(payload?.Contents ?? string.Empty, "../MoreTabs/client.js?v=" + version);
        return Content(html, "text/html; charset=utf-8");
    }

    [HttpGet("Config")]
    [Authorize]
    public ActionResult<IEnumerable<TabConfig>> GetConfig()
    {
        List<TabConfig> tabs = global::Jellyfin.Plugin.MoreTabs.Plugin.Instance?.Configuration.Tabs ?? new List<TabConfig>();
        return Ok(tabs.Where(static t => t.Enabled && (t.Divider || (!string.IsNullOrWhiteSpace(t.Title) && !string.IsNullOrWhiteSpace(t.Url)))).ToList());
    }

    [HttpGet("Status")]
    [Authorize]
    public ActionResult<object> GetStatus()
    {
        return Ok(new
        {
            fileTransformationLoaded = FileTransformationRegistrationService.IsAssemblyLoaded(),
            fileTransformationRegistered = FileTransformationRegistrationService.IsRegistered,
            lastError = FileTransformationRegistrationService.LastError,
            tabCount = global::Jellyfin.Plugin.MoreTabs.Plugin.Instance?.Configuration.Tabs.Count ?? 0,
            injectionLastPath = ScriptInjectionStartupFilter.LastPath,
            injectionLastHtmlLength = ScriptInjectionStartupFilter.LastHtmlLength,
            injectionLastApplied = ScriptInjectionStartupFilter.LastApplied,
            injectionLastSkipReason = ScriptInjectionStartupFilter.LastSkipReason
        });
    }
}
