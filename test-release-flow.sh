#!/bin/bash
set -e

echo "=========================================="
echo "Testing Release Workflow End-to-End"
echo "=========================================="

# Setup
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export PATH="/home/ubuntu/.dotnet:$PATH"
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"
cd /workspace

# Backup manifest
cp manifest.json "$TEST_DIR/manifest.json.backup"

# Clean up function
cleanup() {
    echo ""
    echo "Cleaning up..."
    mv "$TEST_DIR/manifest.json.backup" manifest.json
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT

echo ""
echo "Step 1: Discover plugins"
echo "========================"
PLUGINS=$(python3 .github/scripts/discover-plugins.py --json | jq -c .)
echo "Plugins: $PLUGINS"
PLUGIN_COUNT=$(echo "$PLUGINS" | jq '. | length')
echo "Found $PLUGIN_COUNT plugins"

# Test both plugins
for i in 0 1; do
    PLUGIN=$(echo "$PLUGINS" | jq -c ".[$i]")
    if [ "$PLUGIN" == "null" ]; then
        continue
    fi
    
    PLUGIN_NAME=$(echo "$PLUGIN" | jq -r '.name')
    PLUGIN_SLUG=$(echo "$PLUGIN" | jq -r '.slug')
    PLUGIN_GUID=$(echo "$PLUGIN" | jq -r '.guid')
    CSPROJ=$(echo "$PLUGIN" | jq -r '.csproj')
    
    echo ""
    echo "=========================================="
    echo "Testing Plugin: $PLUGIN_NAME (slug: $PLUGIN_SLUG)"
    echo "=========================================="
    
    # Step 2: Resolve version
    echo ""
    echo "Step 2: Resolve version"
    echo "======================="
    VERSION=$(python3 .github/scripts/next-version.py manifest.json "$PLUGIN_GUID")
    echo "Next version: $VERSION"
    TAG="${PLUGIN_SLUG}-v${VERSION}"
    echo "Tag: $TAG"
    
    # Step 3: Publish plugin
    echo ""
    echo "Step 3: Build plugin"
    echo "===================="
    rm -rf "$TEST_DIR/publish"
    dotnet publish "$CSPROJ" \
        -c Release \
        -o "$TEST_DIR/publish" \
        -p:Version="$VERSION" \
        -p:AssemblyVersion="$VERSION" \
        -p:FileVersion="$VERSION" \
        --verbosity quiet
    echo "Built to $TEST_DIR/publish"
    ls -la "$TEST_DIR/publish"/*.dll | head -3
    
    # Step 4: Package zip
    echo ""
    echo "Step 4: Package zip"
    echo "==================="
    export PLUGIN_SLUG="$PLUGIN_SLUG"
    export VERSION="$VERSION"
    cd "$TEST_DIR"
    python3 - <<'PY'
import os
import zipfile
import hashlib
from pathlib import Path
plugin_slug = os.environ["PLUGIN_SLUG"]
version = os.environ["VERSION"]
zip_name = f"{plugin_slug}_{version}.zip"
with zipfile.ZipFile(zip_name, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in Path("publish").glob("*.dll"):
        archive.write(path, path.name)
checksum = hashlib.md5(Path(zip_name).read_bytes()).hexdigest()
print(f"Created {zip_name}")
print(f"Checksum: {checksum}")
with open("checksum.txt", "w") as f:
    f.write(checksum)
PY
    cd /workspace
    
    ZIP_NAME="${PLUGIN_SLUG}_${VERSION}.zip"
    CHECKSUM=$(cat "$TEST_DIR/checksum.txt")
    echo "Zip: $ZIP_NAME"
    echo "Checksum: $CHECKSUM"
    echo "Size: $(stat -f%z "$TEST_DIR/$ZIP_NAME" 2>/dev/null || stat -c%s "$TEST_DIR/$ZIP_NAME") bytes"
    
    # Step 5: Prepare manifest metadata (simulate GitHub release step)
    echo ""
    echo "Step 5: Prepare manifest metadata"
    echo "=================================="
    SOURCE_URL="https://github.com/DaddyBoard/jellyfin-plugins/releases/download/${TAG}/${ZIP_NAME}"
    REPO="DaddyBoard/jellyfin-plugins"
    
    export PLUGIN_SLUG="$PLUGIN_SLUG"
    export PLUGIN_NAME="$PLUGIN_NAME"
    export PLUGIN_GUID="$PLUGIN_GUID"
    export VERSION="$VERSION"
    export TAG="$TAG"
    export SOURCE_URL="$SOURCE_URL"
    export CHECKSUM="$CHECKSUM"
    export TEST_DIR="$TEST_DIR"
    export PLUGIN_METADATA=$(echo "$PLUGIN" | jq -c .)
    
    mkdir -p "$TEST_DIR/manifest-updates"
    python3 - <<'PY'
import os
import json
data = {
    "zip": f"{os.environ['PLUGIN_SLUG']}_{os.environ['VERSION']}.zip",
    "version": os.environ["VERSION"],
    "sourceUrl": os.environ["SOURCE_URL"],
    "guid": os.environ["PLUGIN_GUID"],
    "name": os.environ["PLUGIN_NAME"],
    "checksum": os.environ["CHECKSUM"],
    "metadata": json.loads(os.environ["PLUGIN_METADATA"])
}
output_path = f"{os.environ['TEST_DIR']}/manifest-updates/{os.environ['PLUGIN_SLUG']}.json"
with open(output_path, "w") as f:
    json.dump(data, f, indent=2)
print(f"Created metadata: {output_path}")
PY
    
    echo "Metadata file contents:"
    cat "$TEST_DIR/manifest-updates/${PLUGIN_SLUG}.json" | jq .
    
    # Validate JSON
    if jq empty "$TEST_DIR/manifest-updates/${PLUGIN_SLUG}.json" 2>/dev/null; then
        echo "✓ Metadata JSON is valid"
    else
        echo "✗ Metadata JSON is INVALID!"
        exit 1
    fi
done

# Step 6: Update manifest for all plugins
echo ""
echo "=========================================="
echo "Step 6: Update manifest for all plugins"
echo "=========================================="
export CHANGELOG="Test release"

for metadata_file in "$TEST_DIR"/manifest-updates/*.json; do
    ZIP=$(jq -r '.zip' "$metadata_file")
    VERSION=$(jq -r '.version' "$metadata_file")
    SOURCE_URL=$(jq -r '.sourceUrl' "$metadata_file")
    GUID=$(jq -r '.guid' "$metadata_file")
    NAME=$(jq -r '.name' "$metadata_file")
    CHECKSUM=$(jq -r '.checksum' "$metadata_file")
    METADATA=$(jq -c '.metadata' "$metadata_file")
    
    echo ""
    echo "Updating manifest for $NAME ($VERSION) with checksum $CHECKSUM"
    
    python3 .github/scripts/update-manifest.py \
        "$ZIP" \
        "$VERSION" \
        "$SOURCE_URL" \
        "$GUID" \
        "$NAME" \
        "$CHECKSUM" \
        "$METADATA"
done

# Step 7: Validate final manifest
echo ""
echo "=========================================="
echo "Step 7: Validate final manifest"
echo "=========================================="

if jq empty manifest.json 2>/dev/null; then
    echo "✓ manifest.json is valid JSON"
else
    echo "✗ manifest.json is INVALID JSON!"
    exit 1
fi

PLUGIN_COUNT=$(jq '. | length' manifest.json)
echo "Plugins in manifest: $PLUGIN_COUNT"

for i in $(seq 0 $((PLUGIN_COUNT - 1))); do
    NAME=$(jq -r ".[$i].name" manifest.json)
    GUID=$(jq -r ".[$i].guid" manifest.json)
    VERSION_COUNT=$(jq ".[$i].versions | length" manifest.json)
    LATEST_VERSION=$(jq -r ".[$i].versions[0].version" manifest.json)
    LATEST_CHECKSUM=$(jq -r ".[$i].versions[0].checksum" manifest.json)
    
    echo ""
    echo "Plugin: $NAME"
    echo "  GUID: $GUID"
    echo "  Versions: $VERSION_COUNT"
    echo "  Latest: $LATEST_VERSION"
    echo "  Checksum: $LATEST_CHECKSUM"
    
    # Validate checksum format
    if [[ $LATEST_CHECKSUM =~ ^[a-f0-9]{32}$ ]]; then
        echo "  ✓ Checksum format valid (MD5)"
    else
        echo "  ✗ Checksum format INVALID: $LATEST_CHECKSUM"
        exit 1
    fi
done

echo ""
echo "=========================================="
echo "✓ All tests passed!"
echo "=========================================="
echo ""
echo "Final manifest.json:"
cat manifest.json | jq .
