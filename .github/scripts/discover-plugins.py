#!/usr/bin/env python3
import json
import sys
from pathlib import Path
import yaml


def main():
    workspace = Path(".")
    plugins = []
    
    for plugin_dir in workspace.glob("Jellyfin.Plugin.*"):
        if not plugin_dir.is_dir():
            continue
        
        build_yaml = plugin_dir / "build.yaml"
        if not build_yaml.exists():
            continue
        
        with open(build_yaml, "r", encoding="utf-8") as f:
            metadata = yaml.safe_load(f)
        
        plugins.append({
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
    
    if "--json" in sys.argv:
        print(json.dumps(plugins, indent=2))
    else:
        for plugin in plugins:
            print(plugin["name"])


if __name__ == "__main__":
    main()
