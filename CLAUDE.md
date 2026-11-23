# lich-plugin

The agent side of the integration with **lich** — a harness that orchestrates agent CLI sessions. This companion plugin is how lich observes and acts inside a running session. It ships hooks — each following a contract documented in `docs/` — plus skills for work that targets lich itself. One plugin, packaged for **Claude Code**, **OpenAI Codex**, **Antigravity CLI**, **opencode**, **omp** (oh-my-pi) and **Crush** from the same repository root.

## Structure

```
.claude-plugin/plugin.json        # plugin manifest, Claude Code
.claude-plugin/marketplace.json   # marketplace, Claude Code
.codex-plugin/plugin.json         # plugin manifest, Codex
.agents/plugins/marketplace.json  # marketplace, Codex
plugin.json                       # plugin manifest, Antigravity — name and place both fixed
hooks.json                        # hook registration, Antigravity — likewise
hooks/hooks.json                  # hook registration, Claude Code
hooks/codex-hooks.json            # hook registration, Codex
hooks/crush-hooks.json            # hook registration, Crush (hand-merged into crush.json)
hooks/                            # hook scripts (all four run them; only how they are addressed differs)
hooks/detail.jq                   # what a tool call acts on, shared by two of those scripts
hooks/conversation-id.sh          # the conversation a payload comes from, sourced by four of them
hooks/veto-subagent.sh            # the subagent veto: the one hook that blocks, waiting on lich's answer
hooks/win-run.cmd                 # runs one of those scripts on Windows (Codex)
hooks/win-veto.cmd                # runs a hook whose stdout is an answer (the veto, the edit note) on Windows (Codex)
opencode/lich.js                  # opencode client: a module, not a command
omp/lich.js                       # omp client: a module, not a command
docs/                             # lich ⇄ plugin communication contracts
skills/                           # skills (skills/<name>/SKILL.md, all)
tests/                            # hook payloads asserted against lich's fixtures
```

**Antigravity** runs the scripts, but on its own terms, and both of them are in
the file layout above. Its plugins are directories — `plugins/<name>/plugin.json`
with `hooks.json` and `skills/` beside it — and neither filename is
configurable, which is why those two sit at the repository root instead of in a
namespaced folder: the root is the plugin directory once the clone is linked in.
It also sets no plugin-root variable, running a hook through `sh -c` with the
working directory set to that root, so its registration alone spells relative
paths; and it reads a JSON verdict off the hook's stdout, so the registration
appends one per event while the report scripts stay silent. `PreToolUse` is the
exception: there the subagent veto, chained after the tool report so a call
gets one verdict, prints it. `agy plugin validate .`
checks the bundle from a clone.

Three harnesses do not fit the script model, each its own way. **opencode** runs
no commands: a plugin there is a JavaScript module its server imports, so all
four reports live in `opencode/lich.js`. **omp** has a `--hook` flag but merges
it with `--extension` into one list it `import()`s, so its "hooks" are modules
too, and its client is `omp/lich.js`. **Crush** runs the scripts unchanged — its
hooks are Claude Code-compatible down to the stdin payload — but before
v0.99.0 had exactly one event, `PreToolUse`, so only the session id, the
touched report (on `PostToolUse` from v0.99.0) and the subagent veto are
registered for it: none of them needs an end of turn.

## Contracts

Contracts are **canonical in the lich repository** (`docs/hooks/` there); this plugin only implements the client side. Each hook has a doc in `docs/` here that points at its contract and describes the plugin-side behavior. Read it before creating or changing a hook:

- [docs/session-state.md](docs/session-state.md) — session-state reporting (`busy`/`done`) via `UserPromptSubmit`/`Stop` and the tool a turn is running via `PreToolUse`
- [docs/session-start.md](docs/session-start.md) — Claude session id via `SessionStart`
- [docs/session-title.md](docs/session-title.md) — the provider's own session title, via `PostToolUse`/`PreInvocation` and `Stop`
- [docs/session-touched.md](docs/session-touched.md) — git-status refresh signal via `PostToolUse` (file-mutating tools only), naming the files written, and lich's edit-overlap note handed to the model (held and collected where the post-write hook cannot show text)
- [docs/subagent-cards.md](docs/subagent-cards.md): the agent's own subagent call becomes a lich session, through a pre-tool hook that asks `/subagent` and turns lich's deny into the harness's veto; every harness but opencode 2, Kiro CLI through lich's own registration
- [docs/providers.md](docs/providers.md) — the per-harness map, including what installing on omp takes and what it cannot report

Each doc carries the event mapping for **every** provider, one column each — a contract is implemented once and registered per harness. [docs/providers.md](docs/providers.md) is the map: which file each harness reads, where the event vocabularies differ, and what adding another provider takes. A harness that cannot close a state does not get that report registered: an unendable `busy` is worse on a card than a card with no indicator.

## Skills

- [skills/theme](skills/theme/SKILL.md) — writing, porting and validating lich color themes, as a single file or as a versioned theme repository. Mirrors the theme contract in the lich repository (`docs/themes.md` there); `template.json` is a copy of the starter lich itself hands out, vendored at `tests/lich-ref` by `tests/refresh-fixtures.sh` and diffed by CI like the fixtures, and `validate.mjs` derives its token sets from that copy. A change to the theme shape, or to the repository contract, lands here too. The harnesses that read no skills out of a plugin (opencode, oh-my-pi, Crush, Kiro CLI) get the skill from lich's install, which fetches `SKILL.md`, `template.json` and `validate.mjs` from the release tag and rewrites the `name: theme` frontmatter line to `name: lich-theme` (`internal/agentplugin/skill.go` in the lich repository): adding, renaming or moving a file the skill needs, or renaming the skill, means changing that list in lich first.
- [skills/extension](skills/extension/SKILL.md) — writing, developing and publishing a lich extension. Mirrors `docs/extensions.md` in the lich repository, which holds every table, limit and the catalog rules: the skill links to it on GitHub `main` instead of copying them, so a change to that contract lands in the skill's steps only when an order or a trap moved. It is manual only wherever the harness can say so: `disable-model-invocation: true` (Claude Code, oh-my-pi, opencode 2) with `user-invocable: true` (Crush needs it to make a command), and `agents/openai.yaml` with `policy.allow_implicit_invocation: false` for Codex, which ignores the frontmatter key and invokes it as `$lich:extension`. opencode 1 reads only `description`, so lich's copy for opencode drops that line. Antigravity documents only `name` and `description`, and Cursor CLI keeps every plugin skill in the agent's list whatever its frontmatter says, so on both it costs its description and the agent may load it; it stays in `skills/` anyway, because Codex's manifest `skills` is one path and moving it out would cost theme or this. lich's install copies it into opencode, oh-my-pi and Crush from 0.21.1 on, and leaves Kiro CLI, which cannot hide a skill, without it (`internal/agentplugin/skill.go` in the lich repository).

## Tests

```bash
node --test tests/*.test.mjs
```

[tests/hooks.test.mjs](tests/hooks.test.mjs) drives every hook script as a real
subprocess — the command line taken from the registration each harness reads —
against a stub HTTP server, and asserts the body it POSTs against lich's
contract fixtures: an accepted shape, no rejected one, the right endpoint, the
token in an `Authorization: Bearer` header and in no process's command line
(with the `?token=` retry a lich older than the header needs), the
`X-Lich-Plugin` header naming the manifest's version, no
deprecated `claude_session_id`, plus the client rules (no lich
environment → no report, exit 0 on a 500 or a refused connection).
[tests/opencode.test.mjs](tests/opencode.test.mjs) does the same for the
opencode module, which is imported rather than spawned, and fed the event
payloads a real opencode run emits — including the sub-session ones it must
drop and the listener that never answers, which must not hold the turn.
[tests/omp.test.mjs](tests/omp.test.mjs) does the same for the omp module,
against the events and `ctx.sessionManager` methods measured on omp v17.3.0 —
pinned in a comment there, because 17.x moves fast — plus the rule that outside
lich it subscribes to nothing at all.
[tests/subagent.test.mjs](tests/subagent.test.mjs) runs every harness's
subagent veto, the script as each registration spells it and the two modules
in process, against a stub answering with the subagent-cards fixture's
answers: the body each sends for its own call, the veto each turns a deny into
with the reason untouched, and the allow every failure is.
[tests/touched.test.mjs](tests/touched.test.mjs) does the same for the
touched report: the paths each harness sends for its own write, `hold` and
`collect` where the post-write hook cannot show text, and every note the
session-touched fixture answers with, handed to the model in that harness's
shape, byte for byte.
[tests/contract.mjs](tests/contract.mjs) is the fixtures, the assertions and the
stub, shared so every client answers to the same lines. Node only, no
dependencies.

The fixtures are vendored in `tests/fixtures/` from lich
(`docs/hooks/fixtures/*.jsonl` there) by
[tests/refresh-fixtures.sh](tests/refresh-fixtures.sh), so the suite never needs
the network. They are read at the lich release named in `tests/lich-ref`, never
at `main`: a contract merged there is one no released lich speaks yet. CI diffs
the copies against that release and fails on drift. A contract lich has not
released at all is the one exception: `refresh-fixtures.sh` reads it at the
commit it pins until a release ships it.

## Rules

- **The fixtures are upstream truth — never edit one to get a green run.** A
  payload that disagrees with a fixture is a bug in the script, or a contract
  change. That one merges in lich first (prose, then fixtures, then its
  endpoint), `tests/lich-ref` pins that merge commit, the plugin release that
  speaks it is tagged here next, and the lich release that installs it is cut
  last.
- A hook must never block or fail the user's turn: short timeout, errors swallowed, always exit 0. The subagent veto is the one hook that blocks, because lich's answer is the decision: it waits 10 seconds at most, and every failure lets the call run. On Codex the exit code is louder still — `2` on `PermissionRequest` denies the request, so silence and exit 0 are what keep a report an observation.
- Outside lich (env vars absent) every hook is a no-op with exit 0 — the plugin must be safe to install globally.
- A skill must be useful from any working directory: the user runs the agent CLI on their own project, not on the lich checkout.
- One script per contract, shared by every provider that runs commands. Registration differs per harness, the report does not — extend a script to read a second transcript format before adding a second script. A harness that runs no commands at all is the one case for a client of its own, which is what `opencode/lich.js` and `omp/lich.js` are; they still send the same payloads to the same endpoints.
- opencode and omp both await their plugin handlers, so neither `lich.js` ever awaits a report or throws — that is their version of "always exit 0". The subagent veto and the touched report are the exceptions in both, as in the scripts: each awaits lich's answer, because the answer is what the model reads (a deny refuses the call, opencode by throwing and omp by returning `{block: true}`; an edit note goes back with the write's result). The omp one also subscribes to nothing outside lich: omp loads it on every run on the machine, so the gate has to be in the module.
- **A module client names only events it was measured emitting.** A name read off a type declaration is a report that silently never fires, which is worse than an absent feature — the omp `waiting` state is left unreported for exactly this reason.
- **The same goes for every other name a registration carries** — an event, a tool a matcher names, a payload field, a plugin-root variable. All of them fail the same way: quietly, on every event, with a green test suite, because a harness that never runs the hook reports nothing to disagree with.
- **A name is measured off a real payload, or it is a guess.** Not from a harness you already support, and not from a symbol table or an enum either — those are the *implementation's* names, and something may map them before they reach a hook. Antigravity is the worked example in both directions: its guide says a tool name is the step type lowercased with `CORTEX_STEP_TYPE_` dropped, and the enum's `MCP_TOOL` still arrives as `call_mcp_tool`. Its write tools really are `write_to_file` and `replace_file_content`, which the enum does not contain. Run the turn, print the payload, read the name off it — a matcher built any other way matches nothing, and losing a report costs no error, only the report.
- **A test that supplies what the harness supplies proves nothing.** The suite exports `$CLAUDE_PLUGIN_ROOT` because Claude Code and Codex do; running Antigravity's registration under it hid the fact that Antigravity does not. Each harness's registration is run the way *that* harness runs it — see `pluginRoot` in `tests/hooks.test.mjs`.

## Local testing

```bash
claude --plugin-dir .
claude plugin validate .claude-plugin/plugin.json   # the manifest and hooks.json
```

Codex has no equivalent one-shot flag; install the clone as a local marketplace instead (`codex plugin marketplace add .` then `codex plugin add lich@lich-plugin`), and trust the hooks once with `/hooks`.

Antigravity has none either, but it does have a checker: `agy plugin validate .`
reads the clone as a plugin and says what it loaded (`skills: 1`, `hooks: 1`) —
a missing or misplaced `plugin.json` fails it outright. To run it for real,
symlink the clone into `~/.gemini/config/plugins/lich`.

## Release

Same standard as the `lich` repository (Keep a Changelog + SemVer). Releases are cut by tagging `vX.Y.Z`:

1. Move the `[Unreleased]` entries in `CHANGELOG.md` under the new version heading (with date) and refresh the compare links at the bottom.
2. Pick the number by what changed: a release that sends anything lich's contract did not already accept (a new endpoint, header, field or value) bumps the **minor** (the major, from 1.0); anything else bumps the **patch**. lich accepts every release below the next minor of the contract it implements, so a contract change released as a patch reaches a lich that refuses it. A contract change is tagged here once lich has merged it and before the lich release that installs it, since that lich may fetch files only this release ships; an older lich never picks it up, because its ceiling stops below this minor. `docs/hooks/README.md` in lich, Versioning, is the rule.
3. Align `version` in `.claude-plugin/plugin.json` **and** `.codex-plugin/plugin.json` with the tag, and `plugin_version` in each `hooks/report-*.sh` and in `hooks/veto-subagent.sh`, and `PLUGIN_VERSION` in `opencode/lich.js` and `omp/lich.js`, the header every report sends. The suite fails while any of them disagrees with the Claude Code manifest. The root `plugin.json` is not a third one to bump: Antigravity's manifest takes only a `name`, and lich writes its own carrying the tag when it installs a release.
4. Annotated tag `vX.Y.Z` + push with the tag.
5. `gh release create vX.Y.Z` with the notes taken from the matching `CHANGELOG.md` section.
