#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path
import yaml


def get_changed_files(base_ref="HEAD~1"):
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", base_ref, "HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip().split("\n")
    except subprocess.CalledProcessError:
        return []


def main():
    base_ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
    
    changed_files = get_changed_files(base_ref)
    
    workspace = Path(".")
    changed_plugins = set()
    
    for changed_file in changed_files:
        path = Path(changed_file)
        for part in path.parts:
            if part.startswith("Jellyfin.Plugin."):
                plugin_dir = workspace / part
                if plugin_dir.is_dir() and (plugin_dir / "build.yaml").exists():
                    changed_plugins.add(str(plugin_dir))
                break
    
    plugins_info = []
    for plugin_dir_str in sorted(changed_plugins):
        plugin_dir = Path(plugin_dir_str)
        build_yaml = plugin_dir / "build.yaml"
        
        with open(build_yaml, "r", encoding="utf-8") as f:
            metadata = yaml.safe_load(f)
        
        plugins_info.append({
            "name": metadata.get("name"),
            "guid": metadata.get("guid"),
            "folder": str(plugin_dir),
            "csproj": str(plugin_dir / f"{plugin_dir.name}.csproj"),
            "overview": metadata.get("overview", ""),
            "description": metadata.get("description", ""),
            "category": metadata.get("category", "General"),
            "owner": metadata.get("owner", ""),
            "targetAbi": metadata.get("targetAbi", "12.0.0.0"),
        })
    
    print(json.dumps(plugins_info, indent=2))


if __name__ == "__main__":
    main()
