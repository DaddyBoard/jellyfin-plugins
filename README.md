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

## Releasing

### Auto-Release
Push to `main` automatically releases plugins with changed files:
- Detects which plugins have modifications via git diff
- Builds each changed plugin independently
- Creates GitHub release with tag `<PluginSlug>-v<version>` (e.g., `SonarrPlaceholder-v1.0.0.0`)
- Updates `manifest.json` with new version
- Version is auto-incremented from manifest

### Manual Release
Manually trigger a release via workflow dispatch:

```bash
# Release specific plugin (use slug, not display name)
gh workflow run release.yaml -f plugin="MoreTabs"
gh workflow run release.yaml -f plugin="SonarrPlaceholder"

# Release all plugins
gh workflow run release.yaml -f plugin="all"

# Custom version
gh workflow run release.yaml -f plugin="MoreTabs" -f version="2.0.0.0"
```

### Adding a New Plugin
1. Create `Jellyfin.Plugin.YourName/` folder
2. Add `build.yaml` with metadata:
   ```yaml
   name: "Display Name"
   guid: "<unique-uuid>"  # Use uuidgen or Python uuid.uuid4()
   version: "1.0.0.0"
   targetAbi: "12.0.0.0"
   framework: "net10.0"
   overview: "Short description"
   description: "Longer description"
   category: "General"
   owner: "DaddyBoard"
   artifacts:
   - "Jellyfin.Plugin.YourName.dll"
   ```
3. Implement plugin following Jellyfin conventions
4. Push to main - auto-releases on first push

## Manual build

```bash
dotnet publish Jellyfin.Plugin.MoreTabs/Jellyfin.Plugin.MoreTabs.csproj -c Release
dotnet publish Jellyfin.Plugin.SonarrPlaceholder/Jellyfin.Plugin.SonarrPlaceholder.csproj -c Release
```

Copy the `.dll` files into `/config/plugins/[PluginName]_[Version]/`.
