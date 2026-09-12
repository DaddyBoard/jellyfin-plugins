# MoreTabs

Jellyfin 12 plugin that adds extra navbar items next to Favourites / Movies / Shows. Each item opens an in-app iframe.

## Install from catalogue

1. Install **File Transformation 3.0+** (Jellyfin 12 build) from `https://www.iamparadox.dev/jellyfin/plugins/manifest.json`
2. In Jellyfin: **Dashboard → Plugins → Repositories → add**

```
https://raw.githubusercontent.com/DaddyBoard/jellyfin-plugins/main/manifest.json
```

3. Catalogue → install **MoreTabs** → restart Jellyfin
4. **Dashboard → Plugins → MoreTabs** → add a title + URL → save
5. Hard-refresh the web client (`Ctrl+F5`)

Push to `main` builds a new zip, creates a GitHub Release, and updates that manifest automatically.

## Manual build

```powershell
dotnet publish "Jellyfin.Plugin.MoreTabs\Jellyfin.Plugin.MoreTabs.csproj" -c Release
```

Copy `Jellyfin.Plugin.MoreTabs.dll` into `/config/plugins/MoreTabs_1.0.0.0/`.
