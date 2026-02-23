'''
SPDX-License-Identifier: Apache-2.0

Copyright 2026 Eaton

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

@File: utils.py
@Description: TODO

@Created: 08 February 2026
@Last Modified: 10 February 2026
@Author: LeonGritsyuk-eaton

@Version: v0.0.0
'''


def render_block(text: str) -> str:
    body = "\n".join(
        f" * {line}".rstrip() if line else " *"
        for line in text.splitlines()
    )
    return f"/*\n{body}\n */"


def render_line(text: str, prefix: str) -> str:
    return "\n".join(
        f"{prefix} {line}".rstrip() if line else prefix
        for line in text.splitlines()
    )


def render_triple_quote(text: str) -> str:
    """Render text as Python triple-quote docstring."""
    return f"'''\n{text}\n'''"