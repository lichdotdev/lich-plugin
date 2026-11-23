# Hook: session touched

Client side of the [session-touched contract](https://github.com/lichdotdev/lich/blob/main/docs/hooks/session-touched.md)
— the contract (transport, endpoint, payload, accepted values) is defined in
the lich repository; this plugin only implements it.

Signals that the session likely changed files on disk, so lich refreshes that
session's git status immediately instead of waiting for its ~3s poll, and names
the files the tool wrote. When another lich session wrote one of them within the
last ten minutes, lich answers with a note, an `edit-overlap` notification
envelope naming that session, which the hook hands to the model. lich writes the
note in the prompt language; the plugin writes no text of its own.

| Harness     | Client                                      | Hook and matcher                                                                       | Paths from                                      | Note delivered by                                 |
|-------------|---------------------------------------------|----------------------------------------------------------------------------------------|-------------------------------------------------|---------------------------------------------------|
| Claude Code | `report-touched.sh`                         | `PostToolUse` `Edit\|Write\|NotebookEdit\|Bash`                                         | `tool_input.file_path`                          | `hookSpecificOutput.additionalContext`            |
| Cursor CLI  | the Claude Code install's                   | the same                                                                               | `tool_input.file_path` (`Write`)                 | the same                                          |
| Codex       | `report-touched.sh`                         | `PostToolUse` `apply_patch\|Edit\|Write\|Bash`, on Windows through `win-veto.cmd`        | the patch's file headers, relative to `cwd`     | `hookSpecificOutput.additionalContext`            |
| Crush       | `report-touched.sh`                         | `PostToolUse` `^(edit\|multiedit\|write\|bash)$` (v0.99.0 on)                            | `tool_input.file_path`                          | `{"version":1,"context":note}`                    |
| Antigravity | `report-touched.sh hold`, then `collect`    | `PostToolUse` `write_file\|edit_file\|write_to_file\|replace_file_content\|run_command`; `PreInvocation` | `toolCall.args.Path`                 | the `PreInvocation` collect's `injectSteps` system message |
| Kiro CLI    | `report-touched.sh hold`, then `collect`    | `postToolUse` `write`, `shell`; `userPromptSubmit` (registered by lich)                  | `tool_input.path`, relative to `cwd`            | the `userPromptSubmit` collect's stdout           |
| opencode 1  | `opencode/lich.js`                          | `tool.execute.after` for `write`, `edit`, `apply_patch`, `bash`                          | `args.filePath`; `apply_patch`'s `metadata.files[].filePath` | appended to `output.output`          |
| oh-my-pi    | `omp/lich.js`                               | `tool_result` for `write`, `edit`, `bash`, `notebook`                                    | `details.resolvedPath`, or `details.path` on `edit` | the handler's `{additionalContext}`           |

`POST /session-touched` with `{"session_id", "paths"?, "hold"?}` after a write,
`{"session_id", "collect": true}` before the next model call. A `200` carries
`{"note"}`; anything else (a `204`, an error, a timeout, a body with no note) is
nothing to say.

## How it behaves

- **Paths are absolute, each once.** A relative one (Codex's patch headers,
  Kiro's `path`) is resolved against the payload's `cwd`, and `.` and `..` are
  folded away, since lich compares the strings as sent. A Windows path is sent
  as given. A tool that names no file (a shell, `run_command`) sends no `paths`
  and is the refresh it always was. Without `jq` the script sends no paths.
- **Where the hook cannot show text, the note is held.** Antigravity reads no
  `PostToolUse` output (an `{}` and the undocumented `overwriteResult` both left
  the result as it was, measured on 1.5.15) and Kiro shows nothing a
  `postToolUse` hook prints (stdout and exit 2 measured on 2.21.0). There the
  write sends `hold`, and the next `PreInvocation` (before every model call) or
  `userPromptSubmit` (the next prompt) collects the note. On Antigravity the
  collect prints `{}` on every path without a note, as every hook there must
  answer.
- **Antigravity renamed its write tools.** 1.5.15 writes with `write_file` and
  `edit_file`, where 1.1.19 used `write_to_file` and `replace_file_content`, so
  the matcher names both pairs. It is told apart by its camelCase
  `conversationId`.
- **Crush is told apart by its payload's `event` field**, the one key Claude
  Code's does not have. On a Crush older than v0.99.0 lich keeps the hook on
  `PreToolUse`, before the write lands: there the script sends no paths and
  prints nothing.
- **opencode reports the write, not `file.edited`.** `file.edited` fires before
  the same write's `tool.execute.after` and has no way to hand text back, so
  reporting both would send one edit twice. A tool that writes but is not one
  of the four (a plugin's own) waits for the poll. A sub-session's write is
  reported too: it edits the same checkout as its card.
- **The note goes as lich wrote it**, byte for byte, and only on a `200` that
  carries one. A held touch never prints one.

The read-only tools stay out of every matcher: a git-status refresh per read
would cost more than the poll it front-runs.

## Not measured

- Claude Code's `NotebookEdit` payload, taken to name its file in `file_path`.
- Cursor CLI's edit of an existing file through a tool other than `Write`.
- opencode 2, which keeps the refresh it had (`execute.after` for `write`,
  `edit`, `patch`, no paths).
- `win-veto.cmd` on Windows.
