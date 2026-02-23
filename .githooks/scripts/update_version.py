from pathlib import Path
import sys

version = sys.argv[1]

for path in Path(".").rglob("*"):
    # Skip node_modules and other common directories to ignore
    if any(part.startswith('.') or part in ['node_modules', 'venv', '__pycache__'] 
           for part in path.parts):
        continue

    # Skip if it's not a file
    if not path.is_file():
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
            lines[i] = line.split("@Version:")[0] + f"@Version: {version}"

    path.write_text("\n".join(lines), encoding="utf-8")