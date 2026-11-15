# Digger — Claude Code rules

2D pixel-art game in **Godot 4.7 / GDScript**. Full technical guide (Persian): `docs/TECHNICAL_GUIDE.fa.md` — read it at session start.

## Workflow
- Use Superpowers: `brainstorming` → `writing-plans` (save to `docs/plans/`) → `executing-plans`. `systematic-debugging` for bugs.
- Verify by running the game through the `godot` MCP (`run_project`, `get_debug_output`) before claiming done.
- Reply to the user in Persian; code, identifiers and commit messages in English.

## Pixel-art rules (do not change without asking)
- Base resolution 320x180, stretch `viewport` + `integer`, texture filter Nearest, 2D pixel snap on.
- Godot game: characters 32x32, tiles 16x16, one project palette (`art_source/palette/`).
- Web game (`web/`): characters are drawn at 3x detail — 96x96 frames (character ~84px tall), shown in the same 32x32 world-px box, so hitbox/physics don't change. Palette `art_source/palette/player_base_hd.hex` (44 colors: skin/brown + cool greys, orange, cyan, navy for suits). Equipment/clothing layers for the player must match 96px frames. Process with `prepare_sprite.py --size 96 --pad 3 --height 84 --ref-frame <standing frame>`; head split for mouse-look: `tools/split_head.py`; pickaxe: `tools/make_pickaxe.py` (3x, tinted by material color in-game).
- Art pipeline: Claude writes prompt → user generates in ChatGPT/Gemini → `tools/prepare_sprite.py` → `aseprite` MCP → Godot. Follow the `making-pixel-art-assets` skill (`.claude/skills/`); user guide: `docs/ART_WORKFLOW.fa.md`.
- Alternative (alongside the manual route): Claude may generate images directly via the Google AI Studio (Gemini) API, reading the key from the `GEMINI_API_KEY` environment variable. Same prompt rules and post-processing apply. On a rate-limit/quota error (HTTP 429, RESOURCE_EXHAUSTED): stop immediately, do not retry or loop, and tell the user what happened (which asset, the error message, what's left).
- Raw AI output goes to `art_source/raw/`; only Aseprite-exported sprite sheets go to `assets/`.

## Conventions
- Files `snake_case`, nodes `PascalCase`, GDScript static typing (`var speed: float = 80.0`).
- Inputs via Input Map actions, never raw keycodes.
- No paid/cloud art services (PixelLab etc.) except the user's Google AI Studio key; never write API tokens into files (use env vars).
- `aseprite` MCP (pixel-mcp): always pass paths with forward slashes (`C:/...`); backslashes break its JSON output.
