from pathlib import Path
import json
import sys

version_tag = sys.argv[1]
header_version = version_tag if version_tag.startswith("v") else f"v{version_tag}"
npm_version = version_tag[1:] if version_tag.startswith("v") else version_tag


def update_package_version(path: Path, next_version: str) -> None:
    try:
        package_data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, PermissionError, OSError):
        return

    if package_data.get("version") == next_version:
        return

    package_data["version"] = next_version
    path.write_text(json.dumps(package_data, indent=2) + "\n", encoding="utf-8")

for path in Path(".").rglob("*"):
    # Skip node_modules and other common directories to ignore
    if any(part.startswith('.') or part in ['node_modules', 'venv', '.venv', 'core-venv', '__pycache__'] 
           for part in path.parts):
        continue

    # Skip if it's not a file
    if not path.is_file():
        continue

    if path.name == "package.json":
        update_package_version(path, npm_version)
        continue
    
    if path.suffix not in [".py", ".js", ".jsx", ".bat"]:
        continue

    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except (PermissionError, OSError):
        # Skip files which can't be read (permissions, special files, etc.)
        continue
        
    if "@Version:" not in text:
        continue

    lines = text.splitlines()
    for i, line in enumerate(lines):
        if "@Version:" in line:
            lines[i] = line.split("@Version:")[0] + f"@Version: {header_version}"

    path.write_text("\n".join(lines), encoding="utf-8")