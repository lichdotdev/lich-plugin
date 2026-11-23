# Hook: subagent cards

Client side of the [subagent-cards contract](https://github.com/lichdotdev/lich/blob/main/docs/hooks/subagent-cards.md)
— the contract (request, answers, timing, the per-provider veto) is defined in
the lich repository; this plugin only implements it.

When the agent calls its own subagent tool, the pre-tool hook asks lich first.
lich opens the task as a session of its own, a card the user can watch and take
over, and answers with a deny; the hook turns it into the harness's own veto, so
the native subagent never runs and the model reads lich's reason. The worker's
report arrives later at the prompt as a `<lich-notification kind="worker-finished">`.
Which subagent types stay native is lich's call, not the plugin's: every call
to a subagent tool is asked about.

| Harness     | Client                         | Event                                   | Tool                                                                 | Veto                                                        |
|-------------|--------------------------------|-----------------------------------------|----------------------------------------------------------------------|-------------------------------------------------------------|
| Claude Code | `veto-subagent.sh claude`      | `PreToolUse` matcher `Agent\|Task`       | `Agent`                                                              | `hookSpecificOutput.permissionDecision: "deny"` on stdout    |
| Cursor CLI  | the Claude Code install's      | the same, in the terminal               | `Task`                                                               | the same                                                    |
| Codex       | `veto-subagent.sh codex`       | `PreToolUse` matcher `spawn_agent\|collaborationspawn_agent\|collaborationwait_agent` | `spawn_agent`, `collaborationspawn_agent` (sealed), `collaborationwait_agent` (a `wait`) | the same JSON as Claude Code                                |
| Antigravity | `veto-subagent.sh antigravity` | `PreToolUse`, chained after the tool report | `invoke_subagent`                                                | `{"decision":"deny","reason":R}` on stdout, `allow` otherwise |
| Kiro CLI    | `veto-subagent.sh kiro`        | `preToolUse`, registered by lich        | `subagent`, `use_subagent` (`InvokeSubagents`)                       | exit 2, `R` on stderr                                       |
| Crush       | `veto-subagent.sh crush`       | `PreToolUse` matcher `^agent$`          | `agent`                                                              | exit 2, `R` on stderr                                       |
| opencode 1  | `opencode/lich.js`             | `tool.execute.before`                   | `task`                                                               | `throw new Error(R)`                                        |
| oh-my-pi    | `omp/lich.js`                  | `tool_call`                             | `task`, one task per entry of its `tasks`                            | `return {block: true, reason: R}`                           |

`POST /subagent` with the contract's body: `session_id`, `provider_session_id`
(the conversation, as the state reports read it), `nested`, `call`, `tool`,
`tool_use_id`, `tasks[]` of `{title, prompt, type}`, `model`, `sealed`,
`isolation`, `background`, every field present, empty or `false` when the
call does not give it. `tool_use_id` is the payload's `tool_use_id`, or
Antigravity's `toolCall.id`. The token rides an `Authorization: Bearer` header
from the script and `?token=` from the two modules, as in every other report.
The script feeds curl the body on stdin and the header through a config on a
file descriptor, so neither the task nor the token is ever a process argument.

## How it behaves

- **It blocks, and fails open.** The call waits on lich's answer, 10 seconds at
  most, because the answer is the decision. No lich, no `jq` (the script), a
  refused connection, a timeout, a status other than 200, a body that is not a
  decision or a deny with no reason: the call runs natively. lich closes what it
  opened for an answer nobody read. Every registration gives the hook 15
  seconds, so a harness never kills it while lich may still be opening a card.
- **The reason is lich's.** It is written in the session's prompt language and
  reaches the model byte for byte; the hook writes no text of its own.
- **A call lich would refuse is not sent.** A spawn with no task, or a task with
  a blank prompt, is left native without a request: lich answers it 400, which is
  an allow anyway. A Codex v2 spawn is sent sealed with an empty prompt, since
  its message is ciphertext; lich answers with a redirect to `open_session`.
- **Nested calls are sent as nested.** Claude Code marks a call from inside a
  native subagent with `agent_id`, and opencode a sub-session by its parent;
  lich allows both. The other harnesses send `nested: false` and lich tells a
  child conversation by `provider_session_id`.
- **Antigravity gets one verdict per call.** Its `PreToolUse` command runs the
  tool report and then the veto on the same payload, kept in a shell variable,
  and the veto prints the verdict for every tool (`allow` for any that is not
  `invoke_subagent`), with an `allow` fallback if the script is missing. How
  Antigravity merges two entries' verdicts is not measured, so it is not asked
  to.
- **Codex on Windows** runs it through `hooks/win-veto.cmd`, which keeps the
  script's stdout: `win-run.cmd` drops it, and a deny lost there would leave a
  card and a native subagent on the same task.

## Registration lich writes

Kiro CLI and Crush keep their hooks in config lich writes, and lich installs
the files for Antigravity, Kiro CLI and Crush from the release by a list.

| Harness     | Event        | Matcher                     | Command                                         | Timeout                |
|-------------|--------------|-----------------------------|-------------------------------------------------|------------------------|
| Kiro CLI    | `preToolUse` | `subagent`                  | `"<plugin>/hooks/veto-subagent.sh" kiro`        | `timeout_ms` 15000     |
| Kiro CLI    | `preToolUse` | `use_subagent`              | `"<plugin>/hooks/veto-subagent.sh" kiro`        | `timeout_ms` 15000     |
| Crush       | `PreToolUse` | `^agent$`                   | `"<plugin>/hooks/veto-subagent.sh" crush`       | 15                     |
| Antigravity | `PreToolUse` | `""` (the plugin's `hooks.json`) | as shipped in `hooks.json`                 | 15                     |

The files each needs: `hooks/veto-subagent.sh` and `hooks/conversation-id.sh`
for all three; Antigravity's `hooks.json` also runs `hooks/report-tool.sh` and
`hooks/detail.jq` as before.

## Measured, and not

The tool names and the input fields are the contract's table, measured by lich
on 2026-11-22. The same day lich measured these whole payloads, which the suite
replays:

- Antigravity: camelCase, `conversationId` and `toolCall: {id, name, args:
  {Prompt, Role, TypeName}}`. It also fires for the subagent's own tools, under
  the subagent's `conversationId`, which lich tells apart by
  `provider_session_id`.
- Kiro CLI over ACP, which lich spawns: `{hook_event_name, cwd, session_id,
  tool_name: "subagent", tool_input: {task, mode, stages: [{name, role,
  prompt_template}]}}`. Its classic chat sends no `session_id`, and its
  `use_subagent` input is `{command: "InvokeSubagents", content: {subagents:
  [{query}]}}` (after a `ListAgents`, which is not asked about).
- Cursor CLI, through the Claude Code install's hook: `{conversation_id,
  session_id, tool_name: "Task", tool_input, tool_use_id, ...}`, no `agent_id`;
  that hook vetoes with Claude Code's JSON in `cursor-agent -p`.

Still not measured, each failing to an allow or an empty field when wrong:

- `tool_use_id` on Codex and Crush payloads.
- How oh-my-pi's `context` joins each task's prompt (here: first, a blank line
  after it).
- `win-veto.cmd` and the file-descriptor config, on a Windows machine.

opencode 2 is left out: its subagent tool is `subagent` and the contract has no
row for it.
