// Reports an omp (oh-my-pi) session to lich. Contracts: ../docs/, canonical in
// https://github.com/lichdotdev/lich/tree/main/docs/hooks
//
// omp runs no hook commands. `--hook` and `--extension` are the same list — it
// merges both into one set of extension paths and loads every entry as a module
// (`import()`), so even the files it calls "hooks" are modules, never scripts
// fed a payload on stdin. So this one file plays the part the four hooks/*.sh
// scripts play on the harnesses that do run commands, the way opencode/lich.js
// does: same transport, same payloads, same rule — outside lich it is a no-op,
// and it never fails the user's turn. It blocks in two places, because there
// the answer is what the model reads: a `task` call waiting on lich's veto
// (vetoReason), and a write waiting on lich's edit note (touchedNote), both
// below.
//
// Every event name and context method used here was measured against omp
// v17.3.0 (@oh-my-pi/pi-coding-agent), against a stub listener, not read off
// its documentation. 17.x moves fast: re-measure before trusting a name that is
// not in this file.
//
// The transport below is a copy of opencode/lich.js's, not an import of it.
// Each client is a single file dropped into its harness's own directory, with
// no package around it to resolve a shared module from — so the duplication is
// the packaging, not an oversight.

// Fire and forget. No report is awaited but two: omp awaits its extension handlers,
// so a slow or dead listener would sit in front of the agent's next step. The
// environment is read per report rather than at import, so a module loaded
// outside lich stays a no-op instead of a cached decision.
// Sent as X-Lich-Plugin on every report; bumped at release (CLAUDE.md, Release).
const PLUGIN_VERSION = "0.22.0"

function report(path, body) {
  const port = process.env.LICH_PORT
  const token = process.env.LICH_TOKEN
  const session = process.env.LICH_SESSION_ID
  if (!port || !token || !session) return
  try {
    fetch(`http://127.0.0.1:${port}/${path}?token=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-lich-plugin": PLUGIN_VERSION },
      body: JSON.stringify({ session_id: session, ...body }),
      signal: AbortSignal.timeout(1000),
    }).catch(() => {})
  } catch {}
}

// The one request this module awaits: lich's answer decides whether a `task`
// call runs (docs/subagent-cards.md), so the call waits for it, 10 seconds at
// most. Every way of not getting a deny (an error, a timeout, a status other
// than 200, a body that is not a decision) resolves to undefined, which lets
// the call run. A deny resolves to lich's reason, untouched.
const VETO_WAIT_MS = 10000

async function vetoReason(body) {
  try {
    const res = await fetch(
      `http://127.0.0.1:${process.env.LICH_PORT}/subagent?token=${process.env.LICH_TOKEN}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-lich-plugin": PLUGIN_VERSION },
        body: JSON.stringify({ session_id: process.env.LICH_SESSION_ID, ...body }),
        signal: AbortSignal.timeout(VETO_WAIT_MS),
      },
    )
    if (res.status !== 200) return undefined
    const answer = await res.json()
    return answer?.decision === "deny" && typeof answer.reason === "string" && answer.reason !== ""
      ? answer.reason
      : undefined
  } catch {
    return undefined
  }
}

const text = (value) => (typeof value === "string" ? value : "")

// The files a write touched go to lich, which answers with a note when another
// session wrote one of them minutes ago (docs/session-touched.md). The note is
// lich's, handed to the model as the tool's result goes back, so the request is
// awaited, a second at most like every report. Every failure says nothing.
async function touchedNote(paths) {
  const port = process.env.LICH_PORT
  const token = process.env.LICH_TOKEN
  const session = process.env.LICH_SESSION_ID
  if (!port || !token || !session) return undefined
  try {
    const res = await fetch(`http://127.0.0.1:${port}/session-touched?token=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-lich-plugin": PLUGIN_VERSION },
      body: JSON.stringify({ session_id: session, ...(paths.length > 0 ? { paths } : {}) }),
      signal: AbortSignal.timeout(1000),
    })
    if (res.status !== 200) return undefined
    const answer = await res.json()
    return typeof answer?.note === "string" && answer.note !== "" ? answer.note : undefined
  } catch {
    return undefined
  }
}

/** The absolute paths among `candidates`, each once, in order. */
function absolutePaths(candidates) {
  return [...new Set(candidates.filter((p) => typeof p === "string" && p.startsWith("/")))]
}

// The `task` call as lich's /subagent body, one task per entry of its `tasks`,
// or undefined when lich would refuse it for want of a prompt, which leaves it
// native without asking. Field names are the contract's table (Event → veto
// mapping), measured on 18.8.9 there; how `context` joins each prompt is not
// given, so it goes first with a blank line after it.
function subagentBody(event, ctx) {
  const input = event?.input
  const entries = Array.isArray(input?.tasks) ? input.tasks : []
  const context = text(input?.context).trim()
  const tasks = entries.map((entry) => ({
    title: text(entry?.name),
    prompt: context && text(entry?.task) ? `${context}\n\n${text(entry.task)}` : text(entry?.task),
    type: text(entry?.agent),
  }))
  if (tasks.length === 0 || tasks.some((task) => task.prompt.trim() === "")) return undefined
  return {
    provider_session_id: sessionIdOf(ctx) ?? "",
    nested: false,
    call: "spawn",
    tool: event.toolName,
    tool_use_id: text(event.toolCallId),
    tasks,
    model: "",
    sealed: false,
    isolation: "",
    background: false,
  }
}

function inLich() {
  return Boolean(process.env.LICH_PORT && process.env.LICH_TOKEN && process.env.LICH_SESSION_ID)
}

// The words for what a tool acts on. omp's built-ins name it `path` (read,
// write, edit, glob), `command` (bash) or `pattern` (grep) — those three are
// measured. `filePath` / `query` / `url` follow for the tools omp does not
// define itself: an extension's or an MCP server's, which spell it however
// their author did. A call carrying none of them sends no detail, which the
// contract accepts.
function detailOf(input) {
  if (!input || typeof input !== "object") return undefined
  for (const key of ["path", "command", "pattern", "filePath", "query", "url"]) {
    const value = input[key]
    if (typeof value === "string" && value !== "") return value
  }
  return undefined
}

// The tools that write to disk, so a git-status refresh is worth its cost.
// Mirrors the `Edit|Write|NotebookEdit|Bash` matcher the script harnesses
// register, in omp's own lower-case spelling. Read-only tools (`read`, `grep`,
// `glob`) must stay out: a refresh per read would cost more than the ~3s poll
// it front-runs.
const WRITERS = new Set(["write", "edit", "bash", "notebook"])

// The id of the session the manager holds, or undefined when it holds none.
function sessionIdOf(ctx) {
  const id = ctx?.sessionManager?.getSessionId?.()
  return typeof id === "string" && id !== "" ? id : undefined
}

// The conversation a state report comes from, so lich can drop one from an
// agent CLI nested in the session (docs/session-state.md, Nested agent CLIs).
function conversation(ctx) {
  const id = sessionIdOf(ctx)
  return id === undefined ? {} : { provider_session_id: id }
}

// omp catches what a handler throws, but a throwing extension is still a
// visible startup warning and a line in its log. Nothing here is worth either.
// omp heads a generated title with a card, `<icon> <CODE>: <title>` (its
// `title.icons` setting, on by default; measured on 18.8.9), which a lich card
// would show as a Nerd Font glyph and a shouting prefix. The pattern and the
// icon test mirror omp's own `splitCardTitle` (src/utils/title-card.ts): an
// icon is non-ASCII and at most 8 codepoints, so `Fix: the parser` stays whole.
const CARD_LINE = /^(\S+) ([A-Z0-9]{1,6}): (\S.*)$/u
const MAX_ICON_CODEPOINTS = 8

function cardIcon(icon) {
  const chars = [...icon]
  return chars.length <= MAX_ICON_CODEPOINTS && chars.every((char) => char.charCodeAt(0) >= 0x80)
}

function withoutCard(title) {
  const line = CARD_LINE.exec(title)
  return line && cardIcon(line[1]) ? line[3] : title
}

const safely = (fn) => (event, ctx) => {
  try {
    fn(event, ctx)
  } catch {}
}

export default function lichPlugin(pi) {
  // Outside lich, nothing is subscribed at all. omp discovers `~/.claude`
  // wholesale, so an install meant for lich is loaded by every omp run on the
  // machine; there is no per-harness registration to gate on. `report` guards
  // itself too — this one just makes sure there is nothing to guard.
  if (!pi || typeof pi.on !== "function" || !inLich()) return

  // The last title sent, so a title that has not changed is not re-sent. lich
  // applies a title only while the card's label is still automatic, so a repeat
  // would be harmless — but it would also be a POST per turn saying nothing.
  let reportedTitle = ""

  // omp generates its session title asynchronously, after a turn: the manager
  // holds it (`getSessionName`) once `setSessionName` has run. So it is read at
  // the end of a turn and at the start of the next — a session whose only turn
  // is its last still reports the title that turn produced, one turn later.
  const reportTitle = (ctx) => {
    const title = ctx?.sessionManager?.getSessionName?.()
    const trimmed = typeof title === "string" ? withoutCard(title.trim()) : ""
    if (!trimmed || trimmed === reportedTitle) return
    reportedTitle = trimmed
    report("session-title", { title: trimmed })
  }

  // The session id lich resumes from. It is on the manager rather than in the
  // environment: omp exports nothing about the running session to its own
  // process env, so `ctx` is the only source.
  const reportStart = safely((_event, ctx) => {
    const id = sessionIdOf(ctx)
    if (id !== undefined) report("session-start", { provider_session_id: id, provider: "omp" })
  })
  pi.on("session_start", reportStart)
  // A `/resume` moves the session onto another conversation with no second
  // `session_start`: omp emits `session_switch` instead, its manager already
  // on the new id (measured on 18.8.9). Reported like a start, so lich holds
  // the conversation the card runs now.
  pi.on("session_switch", reportStart)

  // The user has sent something: the turn starts here in an interactive
  // session, which is the only kind lich spawns.
  pi.on(
    "input",
    safely((_event, ctx) => report("hook", { state: "busy", ...conversation(ctx) })),
  )

  // Every turn passes through here, including the ones no `input` precedes — a
  // continuation, a retry, a print-mode run. It is this contract's equivalent of
  // the `PostToolUse → busy` the script harnesses register: the spinner comes
  // back after anything that cleared it.
  pi.on(
    "turn_start",
    safely((_event, ctx) => {
      report("hook", { state: "busy", ...conversation(ctx) })
      reportTitle(ctx)
    }),
  )

  // The tool line on the card, and lich's say on a `task` call. This handler
  // is on the agent's critical path: returning `{block: true}` from it refuses
  // the call, so it returns that for lich's deny and nothing otherwise. One
  // handler does both, since `safely` drops what a handler returns.
  pi.on("tool_call", async (event, ctx) => {
    try {
      if (typeof event?.toolName !== "string" || event.toolName === "") return
      report("hook", { state: "busy", tool: event.toolName, detail: detailOf(event.input), ...conversation(ctx) })
      if (event.toolName !== "task") return
      const body = subagentBody(event, ctx)
      const reason = body && (await vetoReason(body))
      if (reason) return { block: true, reason }
    } catch {}
  })

  // After the write, not before it: `tool_result` is where the tree has already
  // changed, so the refresh lich runs sees it. The file is the result's
  // absolute path (`details.resolvedPath` on `write`, `details.path` on `edit`,
  // measured on 18.8.9), and lich's note goes back as the handler's
  // additionalContext, which the model reads.
  pi.on("tool_result", async (event) => {
    try {
      if (!WRITERS.has(event?.toolName)) return
      const note = await touchedNote(absolutePaths([event.details?.resolvedPath ?? event.details?.path]))
      if (note) return { additionalContext: note }
    } catch {}
  })

  // The turn settling, which is this contract's `done`. It fires even when the
  // turn ended in a provider error, so the spinner always comes off.
  //
  // Nothing reports `idle`: the event that would say "the CLI has left" is the
  // process exiting with this module inside it. `session_shutdown` fires there,
  // but a report fired and not awaited during shutdown is a report that may not
  // leave — so an omp card holds its last indicator until lich respawns its
  // terminal, like a Codex or an opencode one.
  pi.on(
    "session_stop",
    safely((_event, ctx) => {
      report("hook", { state: "done", ...conversation(ctx) })
      reportTitle(ctx)
    }),
  )
}
