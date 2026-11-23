#!/bin/sh
# Asks lich whether a subagent call runs natively or as a lich session, and
# turns lich's deny into the harness's own veto, so the native subagent never
# runs. Contract: docs/subagent-cards.md
# $1: the harness, which decides how the payload maps to tasks and how the veto
#     is spelled: claude (Cursor CLI runs this one too), codex, antigravity,
#     kiro or crush.
# stdin: the harness's pre-tool payload.
#
# The one hook that blocks: the call waits on lich's answer, because the answer
# is the decision. Every way of not getting one (no lich, no jq, an error, a
# timeout, a status other than 200, a body that is not a decision) lets the call
# run, and lich closes whatever it opened for an answer nobody read. A deny is
# the only text this script passes on, and it is lich's, untouched.

harness=$1

# Antigravity needs a verdict on every path; the others read silence as allow.
allow() {
  [ "$harness" = antigravity ] && printf '{"decision":"allow"}'
  exit 0
}

[ -n "$LICH_PORT" ] && [ -n "$LICH_TOKEN" ] && [ -n "$LICH_SESSION_ID" ] || allow

# Sent as X-Lich-Plugin on every request; bumped at release (CLAUDE.md, Release).
plugin_version=0.22.0

# The body is built from arbitrary text and the answer read back as JSON, so
# without jq there is nothing safe to send.
command -v jq >/dev/null 2>&1 || allow

# A file-shipped install that lacks conversation-id.sh still asks, without
# naming the conversation, as the report scripts do.
if [ -r "${0%/*}/conversation-id.sh" ]; then
  . "${0%/*}/conversation-id.sh"
else
  conversation_id() { :; }
  from_subagent() { return 1; }
fi

payload=$(cat)
conversation=$(printf '%s' "$payload" | conversation_id)
printf '%s' "$payload" | from_subagent && nested=true || nested=false

# The body lich takes, or nothing when the call starts no subagent. Tool and
# field names are the contract's table (Event → veto mapping).
body=$(printf '%s' "$payload" | jq -c --arg harness "$harness" --arg sid "$LICH_SESSION_ID" \
  --arg conversation "$conversation" --argjson nested "$nested" '
  def s: if type == "string" then . else "" end;
  def spawn($tasks): {call: "spawn", tasks: $tasks};
  . as $root
  | (.tool_input // {}) as $in
  | (.toolCall.args // {}) as $args
  | (.tool_name // .toolCall.name // "" | s) as $tool
  | if $harness == "claude" then
      if $tool == "Agent" or $tool == "Task" then
        spawn([{title: ($in.description | s), prompt: ($in.prompt | s), type: ($in.subagent_type | s)}])
        + {model: ($in.model | s), isolation: ($in.isolation | s), background: ($in.run_in_background == true)}
      else empty end
    elif $harness == "codex" then
      if $tool == "spawn_agent" then
        spawn([{title: "", prompt: ($in.message | s), type: ($in.agent_type | s)}])
      elif $tool == "collaborationspawn_agent" then
        spawn([{title: ($in.task_name | s), prompt: "", type: ""}]) + {sealed: true}
      elif $tool == "collaborationwait_agent" then
        {call: "wait", tasks: []}
      else empty end
    elif $harness == "antigravity" then
      if $tool == "invoke_subagent" then
        spawn([{title: "", prompt: ($args.Prompt | s), type: ($args.TypeName | s)}])
      else empty end
    elif $harness == "kiro" then
      if $tool == "subagent" then
        spawn([{title: ($in.stages[0].name? | s), prompt: ($in.task | s), type: ""}])
      elif $tool == "use_subagent" and $in.command == "InvokeSubagents" then
        spawn([$in.content.subagents[]? | {title: "", prompt: (.query | s), type: ""}])
      else empty end
    elif $harness == "crush" then
      if $tool == "agent" then spawn([{title: "", prompt: ($in.prompt | s), type: ""}]) else empty end
    else empty end
  # A spawn lich would refuse (no task, a task with no prompt) is left native
  # here rather than sent: lich answers it 400, which is an allow anyway.
  | select(.call == "wait" or .sealed == true
           or ((.tasks | length) > 0 and all(.tasks[]; .prompt | test("\\S"))))
  | {session_id: $sid, provider_session_id: $conversation, nested: $nested, tool: $tool,
     tool_use_id: ($root.tool_use_id // $root.toolCall.id | s), model: "", sealed: false, isolation: "", background: false}
    + .
' 2>/dev/null)
[ -n "$body" ] || allow

# Neither the token nor the body goes in curl's command line, which every user
# on the machine can read: the body, which carries the task, is fed on stdin and
# the token header through a config on fd 3, both from shell builtins. The
# answer comes back with its status on a last line of its own.
url="http://127.0.0.1:${LICH_PORT}/subagent"
answer=$(printf '%s' "$body" |
  curl -s --max-time 10 -X POST \
    -H 'Content-Type: application/json' \
    -H "X-Lich-Plugin: ${plugin_version}" \
    --data-binary @- -w '\n%{http_code}' -K /dev/fd/3 "$url" 2>/dev/null 3<<EOF
header = "Authorization: Bearer ${LICH_TOKEN}"
EOF
)
[ "$(printf '%s' "$answer" | tail -n 1)" = 200 ] || allow
decision=$(printf '%s' "$answer" | sed '$d' |
  jq -c 'select(.decision == "deny" and (.reason | type) == "string" and .reason != "")' 2>/dev/null)
[ -n "$decision" ] || allow

case $harness in
  claude | codex)
    printf '%s' "$decision" |
      jq -c '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: .reason}}'
    ;;
  antigravity)
    printf '%s' "$decision" | jq -c '{decision: "deny", reason}'
    ;;
  kiro | crush)
    printf '%s' "$decision" | jq -j '.reason' >&2
    exit 2
    ;;
esac
exit 0
