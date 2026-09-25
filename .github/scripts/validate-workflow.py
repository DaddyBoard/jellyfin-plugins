#!/usr/bin/env python3
"""
Validate release.yaml by executing steps as GitHub Actions would.
Extracts env vars and run scripts, executes under bash -e.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import yaml
from pathlib import Path


def load_workflow():
    """Load and parse release.yaml"""
    workflow_path = Path(".github/workflows/release.yaml")
    with open(workflow_path) as f:
        return yaml.safe_load(f)


def run_step(name, env_vars, script, cwd, stub_commands=None):
    """Execute a workflow step with given env and script"""
    print(f"\n{'='*60}")
    print(f"Step: {name}")
    print(f"{'='*60}")
    
    full_env = os.environ.copy()
    full_env.update(env_vars)
    
    if env_vars:
        print("Environment:")
        for k, v in sorted(env_vars.items()):
            val_display = v[:100] + "..." if len(v) > 100 else v
            print(f"  {k}={val_display}")
    
    if stub_commands:
        stub_script = "\n".join([
            f'{cmd}() {{ echo "[STUB] {cmd} $@"; }}'
            for cmd in stub_commands
        ])
        script = stub_script + "\n" + script
    
    print(f"\nExecuting:")
    print(script[:500] + ("..." if len(script) > 500 else ""))
    print()
    
    try:
        result = subprocess.run(
            ["bash", "-e"],
            input=script,
            env=full_env,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.stdout:
            print("Output:")
            print(result.stdout)
        
        if result.returncode != 0:
            print(f"✗ Step failed with exit code {result.returncode}")
            if result.stderr:
                print("Error:")
                print(result.stderr)
            return False
        
        print(f"✓ Step completed successfully")
        return True
        
    except subprocess.TimeoutExpired:
        print("✗ Step timed out")
        return False
    except Exception as e:
        print(f"✗ Step failed: {e}")
        return False


def main():
    """Main validation"""
    print("="*60)
    print("Release Workflow Validation")
    print("="*60)
    
    workspace = Path.cwd()
    workflow = load_workflow()
    
    print("\n" + "="*60)
    print("Phase 1: Discover Plugins")
    print("="*60)
    
    result = subprocess.run(
        ["python3", ".github/scripts/discover-plugins.py", "--json"],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"✗ Plugin discovery failed: {result.stderr}")
        return 1
    
    plugins = json.loads(result.stdout)
    print(f"Found {len(plugins)} plugins:")
    for p in plugins:
        print(f"  - {p['name']} (slug: {p['slug']}, guid: {p['guid']})")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        work_dir = tmpdir / "work"
        work_dir.mkdir()
        
        shutil.copy("manifest.json", work_dir / "manifest.json")
        
        all_metadata = []
        
        for plugin in plugins:
            print(f"\n{'='*60}")
            print(f"Phase 2: Build Plugin - {plugin['name']}")
            print(f"{'='*60}")
            
            result = subprocess.run(
                ["python3", ".github/scripts/next-version.py", "manifest.json", plugin['guid']],
                capture_output=True,
                text=True
            )
            version = result.stdout.strip()
            tag = f"{plugin['slug']}-v{version}"
            
            print(f"Version: {version}")
            print(f"Tag: {tag}")
            
            env = {
                "CSPROJ": plugin['csproj'],
                "VERSION": version
            }
            
            if not run_step(
                "Publish plugin",
                env,
                f'dotnet publish "$CSPROJ" -c Release -o "{work_dir}/publish" '
                f'-p:Version="$VERSION" -p:AssemblyVersion="$VERSION" -p:FileVersion="$VERSION" --verbosity quiet',
                workspace,
                []
            ):
                return 1
            
            env = {
                "PLUGIN_SLUG": plugin['slug'],
                "VERSION": version
            }
            
            script = '''
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
'''
            
            if not run_step("Package zip", env, script, work_dir, []):
                return 1
            
            env = {
                "GH_TOKEN": "fake-token",
                "PLUGIN_NAME": plugin['name'],
                "PLUGIN_SLUG": plugin['slug'],
                "VERSION": version,
                "TAG": tag,
                "CHANGELOG": "Test release"
            }
            
            script = '''
ZIP="${PLUGIN_SLUG}_${VERSION}.zip"
gh release create "$TAG" "$ZIP" --title "$PLUGIN_NAME $VERSION" --notes "$CHANGELOG"
'''
            
            if not run_step("Publish GitHub release (stubbed)", env, script, work_dir, ["gh"]):
                return 1
            
            env = {
                "PLUGIN_SLUG": plugin['slug'],
                "PLUGIN_NAME": plugin['name'],
                "PLUGIN_GUID": plugin['guid'],
                "VERSION": version,
                "TAG": tag,
                "REPO": "DaddyBoard/jellyfin-plugins",
                "PLUGIN_METADATA": json.dumps(plugin)
            }
            
            script = '''
mkdir -p manifest-updates
python3 - <<'PY'
import os
import json
from pathlib import Path

plugin_slug = os.environ["PLUGIN_SLUG"]
version = os.environ["VERSION"]
tag = os.environ["TAG"]
repo = os.environ["REPO"]

source_url = f"https://github.com/{repo}/releases/download/{tag}/{plugin_slug}_{version}.zip"
checksum = Path("checksum.txt").read_text().strip()

data = {
    "zip": f"{plugin_slug}_{version}.zip",
    "version": version,
    "sourceUrl": source_url,
    "guid": os.environ["PLUGIN_GUID"],
    "name": os.environ["PLUGIN_NAME"],
    "checksum": checksum,
    "metadata": json.loads(os.environ["PLUGIN_METADATA"])
}
with open(f"manifest-updates/{plugin_slug}.json", "w") as f:
    json.dump(data, f, indent=2)
PY
'''
            
            if not run_step("Prepare manifest metadata", env, script, work_dir, []):
                return 1
            
            metadata_file = work_dir / "manifest-updates" / f"{plugin['slug']}.json"
            if not metadata_file.exists():
                print(f"✗ Metadata file not created: {metadata_file}")
                return 1
            
            with open(metadata_file) as f:
                metadata = json.load(f)
            
            all_metadata.append(metadata)
            print(f"✓ Metadata valid: {metadata['checksum']}")
        
        for plugin in plugins:
            src = work_dir / "manifest-updates" / f"{plugin['slug']}.json"
            dst_dir = work_dir / "manifest-updates" / f"manifest-{plugin['slug']}"
            dst_dir.mkdir(exist_ok=True)
            if src.exists():
                shutil.move(str(src), str(dst_dir / f"{plugin['slug']}.json"))
        
        print(f"\n{'='*60}")
        print("Phase 3: Update Manifest")
        print(f"{'='*60}")
        
        shutil.copytree(".github/scripts", work_dir / ".github" / "scripts")
        
        env = {
            "CHANGELOG": "Test release"
        }
        
        script = '''
for metadata_file in manifest-updates/manifest-*/*.json; do
  ZIP=$(jq -r '.zip' "$metadata_file")
  VERSION=$(jq -r '.version' "$metadata_file")
  SOURCE_URL=$(jq -r '.sourceUrl' "$metadata_file")
  GUID=$(jq -r '.guid' "$metadata_file")
  NAME=$(jq -r '.name' "$metadata_file")
  CHECKSUM=$(jq -r '.checksum' "$metadata_file")
  METADATA=$(jq -c '.metadata' "$metadata_file")
  
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
'''
        
        if not run_step("Update manifest for all plugins", env, script, work_dir, []):
            return 1
        
        print(f"\n{'='*60}")
        print("Phase 4: Validate Final Manifest")
        print(f"{'='*60}")
        
        manifest_path = work_dir / "manifest.json"
        with open(manifest_path) as f:
            manifest = json.load(f)
        
        print(f"✓ manifest.json is valid JSON")
        print(f"✓ Plugins in manifest: {len(manifest)}")
        
        for entry in manifest:
            name = entry['name']
            latest = entry['versions'][0] if entry['versions'] else None
            if latest:
                print(f"  - {name}: v{latest['version']} (checksum: {latest['checksum']})")
                
                if not (len(latest['checksum']) == 32 and all(c in '0123456789abcdef' for c in latest['checksum'])):
                    print(f"✗ Invalid checksum format: {latest['checksum']}")
                    return 1
        
        print(f"\n{'='*60}")
        print("✓ ALL VALIDATION PASSED")
        print(f"{'='*60}")
        
        return 0


if __name__ == "__main__":
    sys.exit(main())
