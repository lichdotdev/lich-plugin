#!/bin/sh
# Signals that this session likely changed files on disk, so lich refreshes
# its git status ahead of the poll. Contract: docs/session-touched.md

# Outside lich (vars absent) → no-op. Safe to install globally.
[ -n "$LICH_PORT" ] && [ -n "$LICH_TOKEN" ] && [ -n "$LICH_SESSION_ID" ] || exit 0

# Sent as X-Lich-Plugin on every report; bumped at release (CLAUDE.md, Release).
plugin_version=0.21.0

# The token rides a header fed through stdin (printf is a builtin): a query
# string or -H would put it in curl's command line, which every user on the
# machine can read. A lich older than the header answers 401, and only then is
# the report sent the old way.
url="http://127.0.0.1:${LICH_PORT}/session-touched"
set -- -s -o /dev/null --max-time 1 -X POST \
  -H 'Content-Type: application/json' \
  -H "X-Lich-Plugin: ${plugin_version}" \
  -d "{\"session_id\":\"${LICH_SESSION_ID}\"}"
answer=$(printf 'header = "Authorization: Bearer %s"\n' "$LICH_TOKEN" |
  curl "$@" -w '%{http_code}' -K - "$url")
[ "$answer" = 401 ] && curl "$@" "$url?token=${LICH_TOKEN}"

# Never blocks or fails the turn.
exit 0
