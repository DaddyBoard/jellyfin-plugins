using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using Jellyfin.Plugin.SonarrPlaceholder.Helpers;
using Jellyfin.Plugin.SonarrPlaceholder.Models;
using Jellyfin.Plugin.SonarrPlaceholder.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.SonarrPlaceholder.Controllers;

[ApiController]
[Route("SonarrPlaceholder")]
public class SonarrPlaceholderController : ControllerBase
{
    private readonly SonarrService _sonarrService;

    public SonarrPlaceholderController(SonarrService sonarrService)
    {
        _sonarrService = sonarrService;
    }

    [HttpGet("client.js")]
    [AllowAnonymous]
    public IActionResult GetClientScript()
    {
        Stream? stream = Assembly.GetExecutingAssembly()
            .GetManifestResourceStream("Jellyfin.Plugin.SonarrPlaceholder.Web.client.js");
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
        string version = global::Jellyfin.Plugin.SonarrPlaceholder.Plugin.Instance?.Version.ToString() ?? "1";
        string html = IndexHtmlPatch.Apply(payload?.Contents ?? string.Empty, "../SonarrPlaceholder/client.js?v=" + version);
        return Content(html, "text/html; charset=utf-8");
    }

    [HttpGet("MissingEpisodes")]
    [Authorize]
    public async Task<ActionResult<List<PlaceholderEpisode>>> GetMissingEpisodes(
        [FromQuery] int? tvdbId,
        [FromQuery] string? imdbId,
        [FromQuery] int? seasonNumber = null)
    {
        var episodes = await _sonarrService.GetMissingEpisodesAsync(tvdbId, imdbId, seasonNumber).ConfigureAwait(false);
        return Ok(episodes);
    }

    [HttpPost("TestConnection")]
    [Authorize]
    public async Task<ActionResult<bool>> TestConnection([FromBody] TestConnectionRequest request)
    {
        var result = await _sonarrService.TestConnectionAsync(request.SonarrUrl, request.SonarrApiKey).ConfigureAwait(false);
        return Ok(new { success = result });
    }
}

public class TestConnectionRequest
{
    public string SonarrUrl { get; set; } = string.Empty;

    public string SonarrApiKey { get; set; } = string.Empty;
}
