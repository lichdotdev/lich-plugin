# lich-plugin

The agent side of the [lich](https://github.com/lichdotdev/lich) integration. lich is a harness that orchestrates agent CLI sessions; this companion plugin gives it eyes and hands inside each session. It installs on **Claude Code**, **OpenAI Codex**, **Antigravity CLI**, **opencode**, **omp** (oh-my-pi) and **Crush** from this same repository. Every hook implements a contract that is canonical in the lich repository (`docs/hooks/` there); the docs in `docs/` here point at each contract and describe the client side:

- **session state** — `busy`/`done` on the session card (`UserPromptSubmit`/`PreInvocation`/`Stop`)
- **session start** — persists the agent's session id on the lich session (`SessionStart`/`PreInvocation`)
- **session title** — names the card after the session's own title (`Stop`)
- **session touched** — refreshes the card's git status right after file-mutating tools, and hands the model lich's note when another session wrote the same file minutes ago (`PostToolUse`)
- **subagent cards** — turns the agent's own subagent call into a lich session, asking lich before the tool runs (`PreToolUse`, or the module's pre-tool event)

The four reports are what Claude Code, Codex, Antigravity, opencode and omp send. **Crush reports two of them** — its session id and the git-status refresh (on `PostToolUse` from Crush v0.99.0, with the edit note) — and no state: none of its newer turn events was measured yet, and a state nothing can end is worse on a card than no state. **omp reports all four minus the bell**: no event of its own for "your turn" has been measured yet, so its card shows a spinner while the agent waits on you. [docs/providers.md](docs/providers.md) has the event mapping per harness.

On **opencode** under a lich from before it registered its MCP server there, it
also carries the other direction: the operations lich offers a session for
driving the sessions beside it, as tools of opencode's own. A newer lich hands
opencode that server at spawn, as it does Claude Code and Codex, and the module
then defines none. [docs/opencode-tools.md](docs/opencode-tools.md) has the
list and the cases where they are deliberately absent.

On every harness here but opencode 2, and on Kiro CLI through lich's own
registration, the agent's **subagent call** becomes a lich session: before the
tool runs, the plugin asks lich, which opens the task as a card you can watch
and steer and refuses the native call with a reason the model reads. The card's
report arrives at the asking session's prompt on its own as a
`<lich-notification kind="worker-finished">`. Which subagent types stay native,
such as the read-only explorers, is lich's call, and when lich cannot be reached
the native subagent runs. [docs/subagent-cards.md](docs/subagent-cards.md) has
the veto per harness. Since a card shares the checkout unless the call asked
for a worktree, the touched report names the files a write touched, and when
another lich session wrote one of them in the last ten minutes, lich answers
with a note naming it that the hook hands to the model; on Antigravity and Kiro
CLI, whose post-write hooks cannot show text, it arrives before the next model
call or with the next prompt ([docs/session-touched.md](docs/session-touched.md)).

It also ships skills for the parts of lich you configure from inside a session:

- **theme** (`/lich:theme` in Claude Code; on Codex and Antigravity the `theme` skill loads from its description; Cursor CLI loads it from the Claude Code install; lich copies it as `lich-theme` into opencode, where it is `/lich-theme`, oh-my-pi, Crush and Kiro CLI when it installs the plugin there): write, port or fix a lich color theme: the app tokens, the xterm palette, where the file goes, and a validator for the rules that otherwise fail silently
- **extension** (`/lich:extension` in Claude Code, `$lich:extension` on Codex; run by hand only, no agent loads it on its own, except on Antigravity and Cursor CLI, which list every skill a plugin ships to the agent; lich copies it as `lich-extension` into opencode, oh-my-pi and Crush, and leaves Kiro CLI without it): write, develop and publish a lich extension: the template repository, the manifest, permissions, translations, trying it in place, `lich extension check`, a release and the catalog listing

## Structure

```
.claude-plugin/plugin.json        # plugin manifest, Claude Code
.claude-plugin/marketplace.json   # marketplace, Claude Code
.codex-plugin/plugin.json         # plugin manifest, Codex
.agents/plugins/marketplace.json  # marketplace, Codex
plugin.json                       # plugin manifest, Antigravity (name fixed, must sit at the root)
hooks.json                        # hook registration, Antigravity (likewise)
hooks/hooks.json                  # hook registration, Claude Code
hooks/codex-hooks.json            # hook registration, Codex
hooks/crush-hooks.json            # hook registration, Crush (merged into crush.json by hand)
hooks/report-state.sh             # session-state hook
hooks/report-tool.sh              # session-state hook: the tool a turn is running
hooks/report-session-start.sh     # session-start hook
hooks/report-title.sh             # session-title hook
hooks/report-touched.sh           # session-touched hook
hooks/veto-subagent.sh            # subagent-cards hook: lich's veto on a subagent call
opencode/lich.js                  # opencode client: all four reports, the subagent veto and the seven tools, one module
omp/lich.js                       # omp client: the reports and the subagent veto, one module
docs/                             # client-side docs, one per contract
skills/theme/                     # theme skill: SKILL.md, template.json, validate.mjs
skills/extension/                 # extension skill, manual only: SKILL.md, agents/openai.yaml
tests/                            # hook payloads asserted against lich's fixtures
```

One set of hook scripts serves Claude Code, Codex, Antigravity and Crush — they live in `hooks/`. Claude Code and Codex reach them through `$CLAUDE_PLUGIN_ROOT/hooks/<script>`, a variable Codex sets too; Crush ships a placeholder the user replaces. Antigravity sets no such variable — it runs a hook with the working directory set to the plugin root, so its registration spells `hooks/<script>` relative to that, and it is the reason `plugin.json` and `hooks.json` sit at the root: Antigravity fixes both names and looks for them nowhere else. opencode and omp run no commands: in both, what gets loaded is a JavaScript module, so each has a single-file client — `opencode/lich.js` and `omp/lich.js` — sending the same payloads to the same endpoints. [docs/providers.md](docs/providers.md) maps the layout and every harness's event names.

## Installation

### Claude Code

Add this repository as a marketplace and install the plugin:

```bash
claude plugin marketplace add lichdotdev/lich-plugin
claude plugin install lich@lich-plugin
```

The same works inside a session with `/plugin marketplace add lichdotdev/lich-plugin` followed by `/plugin install lich@lich-plugin`.

### Codex

```bash
codex plugin marketplace add lichdotdev/lich-plugin
codex plugin add lich@lich-plugin
```

Then start a new session and run `/hooks` to review and trust the plugin's hooks — Codex does not run a plugin's hooks until you do, so until then the plugin is installed but silent. Hooks themselves are stable and on by default in current Codex; on older versions set `[features] hooks = true` in `~/.codex/config.toml`.

### Antigravity CLI

A plugin is a directory holding a `plugin.json`, under a `plugins/` folder in a customization root. Symlink the clone into one — globally, or into a project's `.agents/` to share it with the team:

```bash
mkdir -p ~/.gemini/config/plugins
ln -s "$PWD" ~/.gemini/config/plugins/lich
```

That is the whole install: the hooks come from `hooks.json` beside the manifest, and the `theme` and `extension` skills from `skills/`. `agy plugin validate .` checks the bundle from the clone before you link it, `agy plugin list` shows it afterwards, and `agy plugin disable lich` turns it off again.

Without the plugin, [`hooks.json`](hooks.json) can be merged into `~/.gemini/config/hooks.json` (global) or `.agents/hooks.json` (per project) — but a hook's working directory is the folder holding the `hooks.json` that declared it, so replace each `hooks/` prefix with the absolute path to this clone.

### opencode

opencode has no marketplace: a plugin is a file in its plugin directory, so dropping it there is the install.

```bash
mkdir -p ~/.config/opencode/plugin
curl -fsSL -o ~/.config/opencode/plugin/lich.js \
  https://raw.githubusercontent.com/lichdotdev/lich-plugin/main/opencode/lich.js
```

Per project instead of globally, use `.opencode/plugin/lich.js`. Updating means fetching the file again.

### omp (oh-my-pi)

omp has no marketplace of its own either, and its `--hook` and `--extension` flags are one list of modules. It scans `~/.omp/agent/extensions/` without being told, so dropping the file there is the install:

```bash
mkdir -p ~/.omp/agent/extensions
curl -fsSL -o ~/.omp/agent/extensions/lich.js \
  https://raw.githubusercontent.com/lichdotdev/lich-plugin/main/omp/lich.js
```

To keep it somewhere else, name the path instead — `omp config set extensions '["/path/to/lich.js"]'`, which writes `extensions:` in `~/.omp/agent/config.yml` — or pass `--hook /path/to/lich.js` for a single run. Per project, `.omp/extensions/lich.js` works the same way. Updating means fetching the file again.

### Crush

Crush has no plugin system either: its hooks live in your own `crush.json`. Clone this repository, then merge [`hooks/crush-hooks.json`](hooks/crush-hooks.json) into `~/.config/crush/crush.json` (global) or the project's `crush.json`, replacing `<lich-plugin>` with the absolute path of the clone:

```jsonc
{
  "hooks": {
    "PreToolUse": [
      { "name": "lich session id", "command": "/home/you/src/lich-plugin/hooks/report-session-start.sh crush", "timeout": 5 },
      { "name": "lich subagent cards", "matcher": "^agent$", "command": "/home/you/src/lich-plugin/hooks/veto-subagent.sh crush", "timeout": 15 }
    ],
    "PostToolUse": [
      { "name": "lich git-status refresh", "matcher": "^(edit|multiedit|write|bash)$", "command": "/home/you/src/lich-plugin/hooks/report-touched.sh", "timeout": 5 }
    ]
  }
}
```

`command` is resolved against the working directory, not the config file, so a global install needs the absolute path. Crush reports no session state and no title — see [docs/providers.md](docs/providers.md) for why.

### Manual (from a clone)

```bash
git clone https://github.com/lichdotdev/lich-plugin.git
```

Then either load it for a single Claude Code session:

```bash
claude --plugin-dir ./lich-plugin
```

or register the clone as a local marketplace for a persistent install:

```bash
claude plugin marketplace add ./lich-plugin
claude plugin install lich@lich-plugin

codex plugin marketplace add ./lich-plugin
codex plugin add lich@lich-plugin
```

Outside lich (env vars absent) the hooks are a no-op — the plugin is safe to install globally.

## Local testing

```bash
claude --plugin-dir .
```

## Tests

```bash
node --test tests/*.test.mjs
```

Every hook script runs as a real subprocess, from the command line its registration spells, against a stub HTTP server — and the body it POSTs is asserted against [lich's contract fixtures](https://github.com/lichdotdev/lich/tree/main/docs/hooks/fixtures): an accepted shape, never a rejected one, the right endpoint, token and `X-Lich-Plugin` header, plus the client rules (no lich environment → no report; exit 0 when lich answers 500 or refuses the connection). The opencode and omp modules are imported instead of spawned and fed the events a real run of each emits, against the same fixtures. All of them share `tests/contract.mjs`. The fixtures are vendored in `tests/fixtures/` by `tests/refresh-fixtures.sh`, at the lich release named in `tests/lich-ref`; CI diffs them against that release so a contract that moves in lich goes red here.
