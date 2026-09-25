# Multi-Plugin Release Pipeline Migration

## What Was Fixed

The release pipeline has been updated from single-plugin (MoreTabs-only) to multi-plugin support. Each plugin now gets its own release, versioning, and manifest entry.

## Changes Made

### 1. Plugin Structure
- **Moved** `build.yaml` from repo root to `Jellyfin.Plugin.MoreTabs/build.yaml`
- **Updated** Sonarr Placeholder GUID from hand-made `a7f8c2e1-3d4b-5c6a-7e8f-9a0b1c2d3e4f` to proper UUID `e5c63724-9d4b-469e-87d5-e6410462109a`
- All plugins now follow consistent structure: `Jellyfin.Plugin.*/build.yaml` with name/guid/overview/description/category/owner/targetAbi

### 2. New Scripts (`.github/scripts/`)
- **`discover-plugins.py`**: Finds all plugins by scanning for `Jellyfin.Plugin.*/build.yaml`
- **`detect-changed-plugins.py`**: Detects which plugins have changed files in a commit
- **`next-version.py`**: Updated to compute version per-plugin by GUID
- **`update-manifest.py`**: Updated to handle multi-plugin manifest, auto-creates missing entries

### 3. Updated Workflow (`.github/workflows/release.yaml`)
- **Matrix strategy**: Builds each changed plugin independently
- **Changed-plugin detection**: Only releases plugins with actual file changes
- **Per-plugin versioning**: Each plugin has its own version sequence in manifest.json
- **Tag naming**: Uses `<PluginName>-v<version>` (e.g., `Sonarr Placeholder-v1.0.0.0`)
- **Workflow dispatch**: Can release specific plugin or "all" plugins manually
- **Manifest commits**: Each plugin release updates manifest independently

### 4. Manifest Structure
- Now supports multiple plugins as array keyed by GUID
- MoreTabs entry preserved with all version history (including bogus 1.0.0.12)
- New plugins auto-initialized when first released
- Each plugin maintains its own metadata (name, description, overview, owner, category)

## Testing Done

### Scripts Validated
```bash
# Plugin discovery
$ python3 .github/scripts/discover-plugins.py
MoreTabs
Sonarr Placeholder

# Next version calculation
$ python3 .github/scripts/next-version.py manifest.json "9f3c2a71-6d84-4b1e-9e2a-1c8f0d5a7b33"
1.0.0.13  # Correctly increments after bogus 1.0.0.12

$ python3 .github/scripts/next-version.py manifest.json "e5c63724-9d4b-469e-87d5-e6410462109a"
1.0.0.0  # New plugin starts at 1.0.0.0

# Manifest update (tested with copy)
$ python3 .github/scripts/update-manifest.py <args>
✓ Creates new plugin entry
✓ Adds version to versions array
✓ Preserves existing plugin entries
```

### Build Validation
```bash
$ dotnet build Jellyfin.Plugin.SonarrPlaceholder/Jellyfin.Plugin.SonarrPlaceholder.csproj -c Release
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

## What Happens After Merge

### Immediate State
1. **Stray MoreTabs 1.0.0.12 release remains** (contains Sonarr changelog, not deleted by this PR)
2. **manifest.json unchanged** by this PR (still only has MoreTabs entry)
3. **Sonarr Placeholder not yet released** (will be released on next push to main)

### First Push to Main After Merge
When the next change is pushed to `main`:

1. **Changed plugin detection** will identify which plugins have modified files
2. **Each changed plugin** will:
   - Get its next version number from manifest
   - Be built and published to GitHub releases
   - Get a new manifest entry (or updated entry)
   - Commit the manifest update

### Sonarr Placeholder First Release

The Sonarr Placeholder plugin will be released automatically when:
- **Option 1**: Any file in `Jellyfin.Plugin.SonarrPlaceholder/` is modified and pushed to main
- **Option 2**: Manual workflow dispatch with `plugin: "Sonarr Placeholder"`
- **Option 3**: Manual workflow dispatch with `plugin: "all"`

To trigger immediately after merge, run:
```bash
gh workflow run release.yaml -f plugin="Sonarr Placeholder"
```

This will:
1. Build and publish `Sonarr Placeholder_1.0.0.0.zip`
2. Create release tag `Sonarr Placeholder-v1.0.0.0`
3. Add Sonarr Placeholder entry to manifest.json with:
   - GUID: `e5c63724-9d4b-469e-87d5-e6410462109a`
   - Name: "Sonarr Placeholder"
   - First version: 1.0.0.0
   - All metadata from build.yaml

## Stray MoreTabs 1.0.0.12 Release

The bogus MoreTabs 1.0.0.12 release exists because the old single-plugin workflow:
- Ran on merge of PR #4 (Sonarr plugin)
- Used the Sonarr PR's merge commit message as changelog
- Tagged and released MoreTabs (the only plugin it knew about)

**This PR does NOT delete it** - manual cleanup required:

1. Delete the release:
   ```bash
   gh release delete MoreTabs-v1.0.0.12 --yes
   ```

2. Remove from manifest (manual edit or script):
   ```bash
   # Edit manifest.json to remove the 1.0.0.12 entry
   # from MoreTabs versions array
   ```

3. Commit and push:
   ```bash
   git add manifest.json
   git commit -m "chore: remove stray MoreTabs 1.0.0.12 release"
   git push
   ```

Alternatively, leave it - the next real MoreTabs release will be 1.0.0.13.

## Workflow Dispatch Options

Manual release triggers:

```bash
# Release only changed plugins (default)
gh workflow run release.yaml

# Release specific plugin
gh workflow run release.yaml -f plugin="MoreTabs"
gh workflow run release.yaml -f plugin="Sonarr Placeholder"

# Release all plugins (rare, use for repo-wide changes)
gh workflow run release.yaml -f plugin="all"

# Custom version (overrides auto-increment)
gh workflow run release.yaml -f plugin="MoreTabs" -f version="2.0.0.0"

# Custom changelog
gh workflow run release.yaml -f plugin="MoreTabs" -f changelog="Major rewrite"
```

## Adding New Plugins

To add a new plugin to the repo:

1. Create `Jellyfin.Plugin.YourPlugin/` folder
2. Add `build.yaml` with metadata:
   ```yaml
   name: "Your Plugin"
   guid: "<unique-uuid>"  # Use uuidgen or Python uuid.uuid4()
   version: "1.0.0.0"
   targetAbi: "12.0.0.0"
   framework: "net10.0"
   overview: "Short description"
   description: "Longer description"
   category: "General"  # or Metadata, LiveTV, etc.
   owner: "DaddyBoard"
   artifacts:
   - "Jellyfin.Plugin.YourPlugin.dll"
   changelog: "Initial release"
   ```
3. Add plugin code following Jellyfin conventions
4. Commit and push to main
5. Plugin will auto-release on first push

## Manifest Owner Discrepancy

- Root `build.yaml` (now MoreTabs) has `owner: "fazmc"`
- Manifest has `owner: "DaddyBoard"`
- **Resolution**: Manifest owner remains `DaddyBoard` (as specified in user requirements)
- MoreTabs build.yaml owner is informational only; manifest.json owner is what Jellyfin uses

## Validation

The scripts were tested locally with:
- ✅ Plugin discovery (finds both plugins)
- ✅ Version calculation (MoreTabs 1.0.0.13, Sonarr 1.0.0.0)
- ✅ Manifest update (creates new entries, preserves existing)
- ✅ Plugin builds (both compile without errors/warnings)
- ⚠️ Workflow syntax (actionlint not available in environment, but manually validated)

## Summary

After merging this PR:
1. ✅ Multi-plugin release pipeline is active
2. ⚠️ Sonarr Placeholder needs one workflow dispatch to create its first release
3. ⚠️ Stray MoreTabs 1.0.0.12 should be manually deleted (or left as-is)
4. ✅ Future pushes automatically release changed plugins
5. ✅ Adding new plugins requires only creating folder + build.yaml
