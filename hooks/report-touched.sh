#!/bin/sh
# Signals that this session likely changed files on disk, so lich refreshes
# its git status ahead of the poll, and names the files written, so lich can say
# when another session wrote one minutes ago. Contract: docs/session-touched.md
# $1: empty after a write that can hand the model text, `hold` after one that
#     cannot (lich keeps the note), `collect` before the next model call (lich
#     hands over what it kept).
# stdin: the harness's post-tool payload (pre-model on `collect`).
#
# lich writes the note; this script only passes it on, in the shape the harness
# reads a hook's extra context in.

mode=$1
payload=$(cat)

# Antigravity reads a JSON verdict off every PreInvocation hook, so a `collect`
# there answers `{}` on every path that has no note. It is the one payload
# spelled in camelCase, `conversationId` in every release measured (its
# `hookEventName` came later).
on_antigravity() {
  case $payload in *'"conversationId"'*) return 0 ;; esac
  return 1
}
done_() {
  [ "$mode" = collect ] && on_antigravity && printf '{}'
  exit 0
}

# Outside lich (vars absent) → no-op. Safe to install globally.
[ -n "$LICH_PORT" ] && [ -n "$LICH_TOKEN" ] && [ -n "$LICH_SESSION_ID" ] || done_

# Sent as X-Lich-Plugin on every report; bumped at release (CLAUDE.md, Release).
plugin_version=0.23.0

command -v jq >/dev/null 2>&1 && has_jq=1 || has_jq=

# The files the tool wrote, absolute and with no `.` or `..` left, each once:
# lich compares them as strings. Claude Code, Cursor CLI and Crush name one in
# `tool_input.file_path`, Kiro in `tool_input.path` relative to `cwd`,
# Antigravity in `toolCall.args.Path`, and a Codex patch in its file headers,
# relative to `cwd`. A Windows path is sent as given. A tool that names no file
# (a shell) sends none. Without jq the paths cannot be read safely, so none are.
paths=
if [ -n "$has_jq" ] && [ "$mode" != collect ]; then
  paths=$(printf '%s' "$payload" | jq -c '
    def norm: split("/") | reduce .[] as $s ([];
      if $s == "" or $s == "." then . elif $s == ".." then .[:-1] else . + [$s] end)
      | "/" + join("/");
    def abs($cwd): if test("^[A-Za-z]:[\\\\/]") then .
      elif startswith("/") then norm else ($cwd + "/" + .) | norm end;
    (.cwd // "") as $cwd
    | [ (.tool_input.file_path, .tool_input.path, .toolCall.args.Path
         | strings),
        (if .tool_name == "apply_patch" then
           .tool_input.command | strings | split("\n")[]
           | capture("^\\*\\*\\* (?:(?:Add|Update|Delete) File|Move to): (?<p>.+)$").p
         else empty end)
      ]
    | map(select(. != "") | abs($cwd))
    | reduce .[] as $p ([]; if index([$p]) then . else . + [$p] end)
    | select(length > 0)' 2>/dev/null)
fi

# A Crush older than v0.99.0 runs this on PreToolUse, before the write lands:
# there it stays the refresh it always was, with no paths and no note.
before_tool=
[ -n "$has_jq" ] && [ "$(printf '%s' "$payload" | jq -r '.hook_event_name // ""' 2>/dev/null)" = PreToolUse ] && before_tool=1 && paths=

if [ "$mode" = collect ]; then
  body="{\"session_id\":\"${LICH_SESSION_ID}\",\"collect\":true}"
elif [ -n "$paths" ]; then
  body=$(jq -cn --arg sid "$LICH_SESSION_ID" --argjson paths "$paths" --argjson hold "$([ "$mode" = hold ] && echo true || echo false)" \
    '{session_id: $sid, paths: $paths} + (if $hold then {hold: true} else {} end)')
elif [ "$mode" = hold ]; then
  body="{\"session_id\":\"${LICH_SESSION_ID}\",\"hold\":true}"
else
  body="{\"session_id\":\"${LICH_SESSION_ID}\"}"
fi

# The token rides a header fed through stdin (printf is a builtin): a query
# string or -H would put it in curl's command line, which every user on the
# machine can read. A lich older than the header answers 401, and only then is
# the report sent the old way. The answer comes back with its status on a last
# line of its own.
url="http://127.0.0.1:${LICH_PORT}/session-touched"
set -- -s --max-time 1 -X POST \
  -H 'Content-Type: application/json' \
  -H "X-Lich-Plugin: ${plugin_version}" \
  -d "$body" -w '\n%{http_code}'
answer=$(printf 'header = "Authorization: Bearer %s"\n' "$LICH_TOKEN" |
  curl "$@" -K - "$url" 2>/dev/null)
[ "$(printf '%s' "$answer" | tail -n 1)" = 401 ] && answer=$(curl "$@" "$url?token=${LICH_TOKEN}" 2>/dev/null)

# A held touch is never answered with a note; anything but a 200 carrying one is
# nothing to say.
[ "$mode" != hold ] && [ -z "$before_tool" ] && [ -n "$has_jq" ] || done_
[ "$(printf '%s' "$answer" | tail -n 1)" = 200 ] || done_
note=$(printf '%s' "$answer" | sed '$d' | jq -c 'select((.note | type) == "string" and .note != "") | .note' 2>/dev/null)
[ -n "$note" ] || done_

# The note goes as lich wrote it: Antigravity's PreInvocation takes it as a
# system message, Kiro's userPromptSubmit as plain stdout, Crush's PostToolUse
# as `context` (its payload alone carries `event`), and Claude Code, Cursor CLI
# and Codex as additionalContext.
if [ "$mode" = collect ]; then
  if on_antigravity; then
    printf '%s' "$note" | jq -c '{injectSteps: [{systemMessage: {systemMessage: .}}]}'
  else
    printf '%s' "$note" | jq -j '.'
  fi
elif printf '%s' "$payload" | jq -e 'has("event")' >/dev/null 2>&1; then
  printf '%s' "$note" | jq -c '{version: 1, context: .}'
else
  printf '%s' "$note" | jq -c '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: .}}'
fi

# Never blocks or fails the turn.
exit 0
