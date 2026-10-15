---
name: theme
description: Write, port, or fix a color theme for the lich harness — the JSON that recolors lich's interface tokens and its xterm terminal palette, as a single file or as a versioned theme repository. Use when asked to build a lich theme, port a palette (Tokyo Night, Gruvbox, Catppuccin, Nord…) into lich, start or lay out a theme repository, publish or version a set of themes, ship an update to a theme somebody already installed, tweak the colors of an installed theme, or when a custom theme is rejected on import, listed in Settings › Appearance as a theme that can't load, or missing from it.
---

# lich themes

A lich theme is one JSON file with two color blocks that are consumed by two
different engines:

- **`app`** — 31 CSS custom properties applied to `<html>`. Repaints the whole
  interface.
- **`terminal`** — an xterm.js theme object handed straight to the terminal.
  Repaints the PTY panes only.

They are picked independently in Settings › Appearance: the terminal picker has
a `Match app theme` default, so one theme can dress both.

Two optional keys go further, read by the native window (`lich native`) only:

- **`syntax`** — colors the code in its review, diff and file views, by
  CodeMirror highlighting tag. See [Syntax highlighting](#syntax-highlighting).
- **`pair`** — the id of the theme's variant for the other scheme, which the
  window draws while the OS asks for that scheme and Auto light/dark is on. See
  [Pairs](#pairs).

`template.json`, next to this file, is the same starter lich itself hands out
(Settings › Appearance › **Save template**). It names every supported color —
start from it, don't type the shape from memory.

## Ask this first: one file, or a repository?

lich imports both, and the difference is versioning, not colors. **Ask the user
which one they want before writing anything** — unless they already said, or the
answer is obvious (they named a repository, or they are fixing a theme that is
already installed from one).

| | Single file | Repository |
|---|---|---|
| What it is | one `<id>.json` | a git repository: `lich-theme.json` manifest + the theme files |
| Install | Import › **Choose file** | Import › paste the URL or path |
| Versioned | no | yes — the manifest's `version` |
| Update later | re-import by hand | **Update** on the theme's row |
| Fits | trying a palette out, a one-off, a theme only you use | anything shared, and anything you will keep changing |

Default when the user has no preference: a single file for one throwaway theme,
a repository as soon as there are two themes or somebody else will install it.

## Where the file lives

The themes directory is lich's to write — it stores a theme there on import, you
never put one there yourself.

| OS      | Directory                                     |
|---------|-----------------------------------------------|
| Linux   | `${XDG_CONFIG_HOME:-$HOME/.config}/lich/themes/` |
| macOS   | `~/Library/Application Support/lich/themes/`   |
| Windows | `%AppData%\lich\themes\`                       |

A lich started with `LICH_DEV` (that's `task dev`) uses `themes-dev/` instead, so
a theme imported in one window is absent from the other.

## Building the theme itself

Same work either way:

1. Copy `template.json` and set `id`, `name`, `scheme`.
2. Fill `app` by **role**, not by hue — see the token table below.
3. Fill `terminal`. `background`/`foreground` are required; give the 16 ANSI
   colors too unless you want xterm's built-in palette fighting your background.
4. Fill `syntax` from the source palette's own code colors, and set `pair` when
   the palette has a light and a dark variant. Both are optional; drop the
   template's `pair` when there is no other variant.
5. Validate: `node validate.mjs <file-or-directory>` (in this skill's directory).
   It checks the same rules the backend checks, so a pass means the install will
   not bounce.

## Handing over a single file

6. Write it where the user can point a file picker at it — the session's working
   directory, as `<id>.json` — and tell them the absolute path.
7. Hand the install to them: **Settings › Appearance › Import › Choose file**,
   then pick that file. lich validates it, stores it under the name it wants,
   applies it and selects it on the spot — no window reload. The file from step 5
   is only the hand-off copy; say it can be deleted once the theme is in.

## Building a repository

The layout is the whole contract — the manifest carries the version, the themes
sit beside it, and nothing lists anything:

```
my-lich-themes/
├── lich-theme.json     {"name": "My themes", "version": "1.0.0"}
├── tokyo-night.json
└── gruvbox.json
```

6. Scaffold it in the user's working directory (or the repository they name):

   ```bash
   mkdir -p my-lich-themes && cd my-lich-themes
   git init
   cat > lich-theme.json <<'EOF'
   {
     "name": "My themes",
     "version": "1.0.0"
   }
   EOF
   ```

7. Write each theme beside the manifest. File names are yours — lich stores each
   one as `<id>.json` in its own directory — so name them after the theme.
8. `node validate.mjs my-lich-themes/` checks the manifest and every theme at
   once, the same way an install reads them. Commit only once it passes.
9. Hand the install to them: **Settings › Appearance › Import**, paste the
   **absolute path** of the directory, **Install**. An absolute path is an
   accepted remote, so this works before the repository is pushed anywhere. Once
   it is on a host, the clone URL is what everyone else pastes.

Shipping a change to an installed pack: edit the themes, **bump `version` in the
manifest**, commit, push. The user takes it with **Update** on the theme's row.

## Validation rules (the backend rejects anything else)

- `formatVersion`: optional, the theme file format. Omitted means `1`, the only
  format so far, so leave it out. When present it is a positive integer no
  greater than the format this lich reads (currently `1`); a newer one is
  refused by that number ("theme format 2 is newer than this lich reads (up to
  1); update lich"). lich writes it into every theme it stores.
- `id`: required, matches `^[a-z0-9][a-z0-9._-]{0,63}$`. Not `light`, `dark`,
  `system` or `match`; not a Windows device name (`con`, `prn`, `aux`, `nul`,
  `com1`–`com9`, `lpt1`–`lpt9`) — the id names a file.
- `name`: required, non-blank, ≤ 128 characters.
- `scheme`: `light` or `dark`. Nothing else.
- `app`: **every one of the 33 tokens** must be present. An unknown token is an
  error, not a warning.
- `terminal`: `background` and `foreground` required; the other 20 tokens
  optional. Unknown tokens rejected.
- Repository only: `lich-theme.json` is required at the root with a non-blank
  `name` and a `MAJOR.MINOR.PATCH` `version` — a pre-release like `1.0.0-rc1` is
  rejected, because the update check cannot order two of them. At least one and
  at most 32 themes beside it, each with a distinct `id`.
- Repository only, optional in the manifest:
  - `minLichVersion`: the oldest lich release the pack is written for, as
    `MAJOR.MINOR.PATCH`. An older lich refuses the install or update ("theme
    pack needs lich X or newer (this is Y); update lich") and leaves what is
    installed alone; a dev build, or one between release tags, skips the check.
    Set it when a theme uses a token only a recent lich has, so an older lich
    names the version it needs instead of an unknown token.
  - `formatVersion`: the same rule as in a theme file; a newer one is refused
    with the error prefixed `manifest: `.
- Color values: non-blank, ≤ 128 characters.
  - `app` accepts hex (`#rgb` … `#rrggbbaa`), a CSS color name, or
    `rgb()`/`rgba()`/`hsl()`/`hsla()`/`oklch()`/`oklab()`/`lab()`/`lch()`/`color()`.
    `var()`, `color-mix()`, `url()`, `attr()`, `image-set()` are rejected —
    a theme may not name a resource or defer a value.
  - `terminal` accepts **hex only**. See the traps.
- `syntax`: optional, an object. Each key is a highlighting tag
  (`keyword`, `comment`, `variableName`…) or a modifier wrapping one
  (`definition`, `constant`, `function`, `standard`, `local`, `special`, as in
  `function(variableName)`); an unknown tag or modifier is an error. Each value
  is a color, accepted as an `app` color is, or an object with `color` and any
  of `bold`, `italic`, `underline`, `strikethrough` set to `true`. An object
  with neither a color nor a font style is an error.
- `pair`: optional, a theme id, not the theme's own. lich lists a theme whose
  pair is installed with **the same** scheme as a theme that can't load,
  bundled `light` and `dark` included. A pair nobody installed is fine: the
  theme loads, with nothing to follow to.
- The file is read only if it is a regular file ≤ 1 MB.

## Traps

- **Copying a file into the themes directory is not installing it.** The theme
  list is read once, at page load, so nothing appears until the window is
  reloaded, so the user is told the theme is in and cannot find it in Settings.
  After the reload, a file that fails a rule, is named anything but its own
  `<id>.json`, or declares a newer `formatVersion` shows up under the theme strip
  as a theme that can't load, with the reason and a Remove action, never as a
  theme to pick. A file whose name is not a valid theme id is only logged. Import
  is the only path that ends with the theme selected and the errors spelled out
  before anything is stored.
- **A non-hex terminal color half-applies.** xterm parses hex directly;
  everything else goes through a round-trip that throws on translucency and is
  swallowed into a fallback. The backend rejects it up front — don't work around
  it, convert the color to hex.
- **`scheme` is not decoration.** It toggles the `.dark` class on the root, which
  drives every `dark:` variant in the components. A dark palette declared
  `"scheme": "light"` renders half-lit.
- **Missing ANSI colors are not inherited from the previous theme** — they fall
  back to xterm's defaults, which were not chosen against your background.
- **`origin` is overwritten with `custom` on install.** Leave it out. `source` is
  lich's too: it writes the repository and version there, and strips whatever a
  picked file claimed.
- **A repository installs all or nothing.** One invalid theme fails the whole
  pack, and the valid siblings are not written either — validate the directory,
  not the file you just touched.
- **An unbumped `version` ships nothing.** The manifest version is the only thing
  Update compares; new colors under the same number are reported as already up to
  date. Bump it in the same commit that changes a theme.
- **The version is the pack's, not the theme's.** Updating one theme of a
  repository re-installs every theme in it, at the manifest's version.
- **The status colors are not yours.** Done/added is `emerald-500`, waiting is
  `amber-500`, terminal search hits are amber, and diff gutters use both. They
  are hardcoded, so check they still read on your `background`, `card` and
  terminal background.
- Reimporting an id that already exists asks before replacing it.

## Syntax highlighting

`syntax` styles code by [CodeMirror highlighting tag](https://lezer.codemirror.net/docs/ref/#highlight.tags),
and resolves the way CodeMirror's `HighlightStyle` does: code takes the style of
the most specific tag that has one, so `lineComment` falls back to `comment` and
`definition(propertyName)` to `propertyName`; code no style reaches is drawn in
`app.foreground`. Style the broad tags first (`keyword`, `string`, `comment`,
`number`, `typeName`, `variableName`, `propertyName`, `function(variableName)`,
`operator`, `punctuation`), then the specific ones a port wants apart.

```json
"syntax": {
  "keyword": "#c4a7e7",
  "string": "#f6c177",
  "comment": { "color": "#6e6a86", "italic": true },
  "function(variableName)": "#ebbcba",
  "constant(variableName)": { "color": "#83c092", "bold": true },
  "annotation": "#e39b7b",
  "heading": { "bold": true }
}
```

Port it from the source's own editor theme, not by guessing from the ANSI
colors: a JetBrains color scheme XML or a VS Code theme's `tokenColors` names
what each kind of token gets. lich tags Java's enum constants
`constant(variableName)`, its annotations `annotation`, its field declarations
`definition(propertyName)` and its import paths `namespace`, which is what an
IDE's constant, metadata, field and package colors map to.

A lich that predates `syntax` ignores the key, so a pack adds it without a
`minLichVersion`.

## Pairs

A palette with a light and a dark variant pairs them, so the native window can
follow the desktop: with Auto light/dark on, it draws the pair while the OS asks
for the pair's scheme, and goes back when it stops. The theme the user chose
stays the one in use.

```json
{ "id": "forest-night", "scheme": "dark",  "pair": "forest-day",   ... }
{ "id": "forest-day",   "scheme": "light", "pair": "forest-night", ... }
```

A pair need not point back. Three dark variants and one light one pair each
dark with the light, and the light with the variant most people pick: a user on
any dark variant comes back to it, since only the chosen theme is ever followed
from. A single-variant palette leaves `pair` out.

A lich that predates `pair` ignores the key, so a pack adds it without a
`minLichVersion`.

## App tokens by role

Surfaces (each `*-foreground` is the text drawn **on** that surface — keep the
pair contrasty, they are never used apart):

| Token | Role |
|---|---|
| `background` / `foreground` | app ground and primary text |
| `card` / `popover` (+ `-foreground`) | raised chrome: tabs, footer, dock, menus, dialogs |
| `sidebar` / `sidebar-foreground` | the session sidebar |
| `accent` / `accent-foreground` | **the workhorse** — hover and selected fill everywhere. Also used at `/50`–`/60` opacity for hover, so it must read as a step off `background`, not as a color |
| `secondary` (+ `-foreground`) | low-emphasis fills |
| `muted` / `muted-foreground` | secondary text, resting icons, paths, meta |
| `primary` / `primary-foreground` | the single high-emphasis button fill, and the Switch when on |
| `destructive` | destructive actions and diff removals — must stay legible as red |
| `tone-pass` / `tone-wait` | status tones: a pass (green) and a wait (amber) on session icons, pull request checks and reviews. Drawn as text and icons on `background`/`card`, so they need contrast there. Required since lich 0.53.0 — a pack that carries them is one an older lich rejects as unknown tokens, which is what `minLichVersion: "0.53.0"` names |
| `border` | hairline seams. Translucent works well in dark (`oklch(1 0 0 / 10%)`) |
| `input` | input and control edges, usually a touch stronger than `border` |
| `ring` | focus ring, always visible |
| `chart-1` … `chart-5` | data series |
| `sidebar-primary`, `sidebar-accent`, `sidebar-border`, `sidebar-ring` (+ their `-foreground`s) | the same roles scoped to the sidebar; mirroring the app values is fine |

The bundled Light and Dark are achromatic zinc by design — a chromatic palette
is exactly what a custom theme is for.

## Terminal tokens

Required: `background`, `foreground`.
Optional: `cursor`, `cursorAccent`, `selectionBackground`, `selectionForeground`,
`black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`,
`brightBlack`, `brightRed`, `brightGreen`, `brightYellow`, `brightBlue`,
`brightMagenta`, `brightCyan`, `brightWhite`.

`cursorAccent` is the glyph *under* a block cursor — set it to the background.
`brightBlack` is what dim TUI text lands on; too close to `background` and
Claude Code's own meta lines vanish.

## Checklist

- [ ] The user was asked single file or repository, or had already said
- [ ] `validate.mjs` passes — on the **directory** when it is a repository
- [ ] `scheme` matches the actual lightness of the palette
- [ ] `accent` is visibly a step off `background` but not a second brand color
- [ ] `border` reads as a hairline, not a rule
- [ ] `emerald-500` / `amber-500` / `destructive` still read on your surfaces
- [ ] Terminal `background` sits well beside app `background` (they touch)
- [ ] `syntax` ported from the source's editor theme, the broad tags styled
- [ ] `pair` set on every variant of a light-and-dark palette, and on no
      single-variant one
- [ ] Repository: `version` bumped in the same commit as a theme change
- [ ] Handed over as a path plus the Settings › Appearance › Import step —
      never written into the themes directory
