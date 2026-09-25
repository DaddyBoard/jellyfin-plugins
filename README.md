# Jellyfin Plugins

Collection of Jellyfin 12 plugins.

## Plugins

### MoreTabs

Adds extra navbar items next to Favourites / Movies / Shows. Each item opens an in-app iframe.

[See full documentation →](Jellyfin.Plugin.MoreTabs/README.md)

### Sonarr Placeholder

Shows greyed-out placeholder episode cards for unaired/missing episodes tracked by Sonarr. Great for currently-airing shows where only a few episodes are downloaded.

**Features:**
- Placeholder cards for episodes tracked by Sonarr but not in Jellyfin
- Live countdown timers for upcoming episodes (e.g., "3d 4h")
- Configurable display options (show/hide aired-but-missing, unaired episodes)
- Integrates with Sonarr v3 API
- Non-intrusive: no fake library items

**Requirements:** File Transformation 3.0+ plugin

[See full documentation →](Jellyfin.Plugin.SonarrPlaceholder/README.md)

## Install from catalogue

1. In Jellyfin: **Dashboard → Plugins → Repositories → add**

```
https://raw.githubusercontent.com/DaddyBoard/jellyfin-plugins/main/manifest.json
```

2. Catalogue → install the plugin → restart Jellyfin
3. Configure via **Dashboard → Plugins → [Plugin Name]**
4. Hard-refresh the web client (`Ctrl+F5`)

Push to `main` builds a new zip, creates a GitHub Release, and updates that manifest automatically.

## Manual build

```powershell
dotnet publish "Jellyfin.Plugin.MoreTabs\Jellyfin.Plugin.MoreTabs.csproj" -c Release
dotnet publish "Jellyfin.Plugin.SonarrPlaceholder\Jellyfin.Plugin.SonarrPlaceholder.csproj" -c Release
```

Copy the `.dll` files into `/config/plugins/[PluginName]_[Version]/`.
