# opencode tools

The other contracts in this directory are about **reporting**: they tell lich
what a session is doing. This one is the other direction — what a session can
*do* to the sessions beside it: list them, hand one a task, answer one, open a
new one, rename one, close one, drive or ask one, look at the worktrees, file
them into folders.

lich exposes those operations twice, and both are documented in
[`docs/cli.md`](https://github.com/lichdotdev/lich/blob/main/docs/cli.md) there:
as the `lich` command line, and as MCP tools it registers at spawn — for
opencode through `$OPENCODE_CONFIG_CONTENT`, the inline config it merges over
its files. A lich from before that registration hands opencode nothing, and a
plugin there cannot register an MCP server, but it can define tools, so that is
what `opencode/lich.js` does for those sessions.

## What is registered

The same fourteen the MCP server offers, under the same names, because an agent
that learns one surface should find the other under the names it already knows:

| Tool | What it does |
|---|---|
| `list_sessions` | The live sessions that can be given work, as JSON. |
| `send_to_session` | Hand a task to one and wait for its agent's answer. |
| `wait_for_answer` | Wait again on a ticket an earlier send handed back. |
| `reply_to_session` | Answer a task another session sent you. |
| `open_session` | Open a session, optionally on a fresh git worktree. |
| `close_session` | Close one, and settle what happens to its checkout. |
| `rename_session` | Rename one — or your own card, which is the form an agent has. |
| `control_session` | Drive a Claude Code session: prompt, abort, model, effort, a slash command. |
| `ask_session` | Ask a Claude Code session a side question, outside its conversation. |
| `list_worktrees` | The checkouts, what is uncommitted, who is in them. |
| `list_folders` | The sidebar folders, and the sessions filed under each, as JSON. |
| `file_session` | File a session under a folder, or take it out with an empty one. |
| `rename_folder` | Rename a folder, or take it apart with an empty name. |
| `color_folder` | Paint a folder's sessions one color, or clear it with an empty one. |

## They shell out to `lich`

Each tool builds an argv and runs the `lich` binary. It would have been fewer
moving parts to POST to the same loopback endpoint the reports use — and it
would have been the third implementation of one contract, in a repository lich
cannot see. An argument that moved in `docs/cli.md` would have gone red in
neither.

Shelling out keeps the argv here and everything else there: which arguments are
required, what a refusal says, the rule that a worktree's last session decides
that checkout's fate, and every wording written for an agent to act on. A
command that fails answers with its own stderr, unedited, for the same reason.

The binary is `$LICH_BIN`, never `lich` off `PATH`: a machine running an
installed lich beside a `task dev` build has two, and only the one in the
environment belongs to this session.

## When they are absent

Three cases, all deliberate, and in each the **reports keep working** — they
need none of the things below:

- **lich registered its server.** A `lich` entry under `mcp` in
  `$OPENCODE_CONFIG_CONTENT` means the session already has every operation from
  lich's own MCP server, `browser_*` included. Defining them here too would list
  each one twice.
- **Outside lich.** No `LICH_PORT` / `LICH_TOKEN` / `LICH_SESSION_ID` in the
  environment means no tools registered at all. Tools that could only answer
  "no lich is running" would be that many tools in the prompt of every
  unrelated opencode session on the machine.
- **Without opencode's plugin package.** The `tool` helper is imported at run
  time, inside a `try`: it resolves from opencode's own plugin dependencies, and
  a module dropped where those do not reach would otherwise fail at import and
  take the reports down with it.

## The wait is capped

`send_to_session` and `wait_for_answer` cap their wait at 90 seconds, mirroring
lich's own MCP server. The ticket is what makes that cheap: a wait that ends
unanswered costs one more tool call, and the answer arrives at your prompt when
it exists.

A wait that runs out exits 2 and one whose errand ended with no answer coming
exits 3 (`docs/cli.md` in lich). Both are results, so the tool returns what lich
printed, the ticket or the reason, rather than reporting a failure.
`control_session` reads the same two codes the same way: 2 is a command the
session took and has not confirmed yet, 3 one it ended before confirming.
