# Sourced by the report scripts, not run: conversation_id reads a hook payload on
# stdin and prints the provider's id for the conversation that fired it, or
# nothing; from_subagent succeeds when a subagent inside it did. Antigravity names it `conversationId`, every other harness
# `session_id`. Prefers jq; falls back to sed so it works on Windows, where jq is
# usually absent but sed (Git Bash) is not.
conversation_id() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.conversationId // .session_id // empty' 2>/dev/null
  else
    sed -n -e 's/.*"conversationId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
           -e 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
  fi
}

# Claude Code fires the session's tool hooks for its subagents too, adding
# `agent_id` (measured on 2.1.302), and their tools keep running after the
# session's Stop. Without jq the match is not anchored to the top level, so a
# tool input carrying its own `agent_id` reads as a subagent's call: one
# unreported tool, against a card stuck on busy.
from_subagent() {
  if command -v jq >/dev/null 2>&1; then
    jq -e 'has("agent_id")' >/dev/null 2>&1
  else
    grep -q '"agent_id"[[:space:]]*:[[:space:]]*"'
  fi
}
