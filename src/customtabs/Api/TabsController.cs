using System.Collections.Generic;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CustomTabsJF12.Configuration;

namespace CustomTabsJF12.Api;

[ApiController]
[Route("CustomTabsJF12")]
public class TabsController : ControllerBase
{
    [HttpGet("Tabs")]
    [AllowAnonymous]
    public ActionResult<IEnumerable<CustomTab>> GetTabs()
    {
        if (Plugin.Instance == null)
        {
            return new List<CustomTab>();
        }

        return Ok(Plugin.Instance.Configuration.Tabs);
    }
}
