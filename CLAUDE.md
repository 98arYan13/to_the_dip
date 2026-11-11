# Digger — Claude Code rules

2D pixel-art game in **Godot 4.7 / GDScript**. Full technical guide (Persian): `docs/TECHNICAL_GUIDE.fa.md` — read it at session start.

## Workflow
- Use Superpowers: `brainstorming` → `writing-plans` (save to `docs/plans/`) → `executing-plans`. `systematic-debugging` for bugs.
- Verify by running the game through the `godot` MCP (`run_project`, `get_debug_output`) before claiming done.
- Reply to the user in Persian; code, identifiers and commit messages in English.

## Pixel-art rules (do not change without asking)
- Base resolution 320x180, stretch `viewport` + `integer`, texture filter Nearest, 2D pixel snap on.
- Characters 32x32, tiles 16x16, one project palette (`art_source/palette/`).
- Art pipeline: Claude writes prompt → user generates in ChatGPT/Gemini → `tools/prepare_sprite.py` → `aseprite` MCP → Godot. Follow the `making-pixel-art-assets` skill (`.claude/skills/`); user guide: `docs/ART_WORKFLOW.fa.md`.
- Raw AI output goes to `art_source/raw/`; only Aseprite-exported sprite sheets go to `assets/`.

## Conventions
- Files `snake_case`, nodes `PascalCase`, GDScript static typing (`var speed: float = 80.0`).
- Inputs via Input Map actions, never raw keycodes.
- No paid/cloud art services (PixelLab etc.); never write API tokens into files.
- `aseprite` MCP (pixel-mcp): always pass paths with forward slashes (`C:/...`); backslashes break its JSON output.
