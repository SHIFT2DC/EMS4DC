import sys
from pathlib import Path
from datetime import datetime

from license_templates import HEADER_TEMPLATE
from utils import render_block, render_line, render_triple_quote

file_path = Path(sys.argv[1])
author = sys.argv[2]
date = sys.argv[3]

OWNER = "Eaton"
VERSION_DEFAULT = "v0.0.0"

STYLE = {
    ".py": ("triple_quote", None),
    ".bat": ("line", "::"),
    ".js": ("block", None),
    ".jsx": ("block", None),
}.get(file_path.suffix)

if not STYLE:
    sys.exit(0)

# Skip header updaters so that they dont modify them selves
if "update_headers.py" in file_path.parts or "update_version.py" in file_path.parts:
    sys.exit(0)

# Skip node_modules
if "node_modules" in file_path.parts:
    sys.exit(0)

comment_type, prefix = STYLE
text = file_path.read_text(encoding="utf-8", errors="ignore")

# ---------- NEW FILE ----------
if "SPDX-License-Identifier" not in text:
    header_text = HEADER_TEMPLATE.format(
        year=datetime.now().year,
        owner=OWNER,
        filename=file_path.name,
        description="TODO",
        created=date,
        modified=date,
        author=author,
        version=VERSION_DEFAULT,
    )

    if comment_type == "block":
        header = render_block(header_text)
    elif comment_type == "triple_quote":
        header = render_triple_quote(header_text)
    else:
        header = render_line(header_text, prefix)

    file_path.write_text(f"{header}\n\n{text}", encoding="utf-8")

# ---------- EXISTING FILE ----------
else:
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if "@Last Modified:" in line:
            if comment_type == "block":
                lines[i] = f"@Last Modified: {date}"
            elif comment_type == "triple_quote":
                lines[i] = f"@Last Modified: {date}"
            else:
                lines[i] = f"{prefix} @Last Modified: {date}"
    file_path.write_text("\n".join(lines), encoding="utf-8")