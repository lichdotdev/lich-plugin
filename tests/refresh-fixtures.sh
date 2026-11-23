#!/bin/sh
# Refreshes the vendored copies of lich's hook-contract fixtures, and of the
# theme template the theme skill hands out and validates against.
#
# The fixtures are canonical in the lich repository (docs/hooks/fixtures/
# there). This repository only vendors them so the test suite never needs the
# network. They are read at the lich release named in tests/lich-ref, never at
# main: a contract lich has merged but not released is one no user's lich
# speaks yet. Move that ref when a lich release changes a contract, run this,
# and make the scripts match; CI diffs the copy against that release and fails
# on drift.
#
# Never hand-edit a fixture to get a green run — a fixture moves in lich, and
# only because the contract moved.
set -eu

here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ref=$(tr -d '[:space:]' <"$here/lich-ref")
raw=https://raw.githubusercontent.com/lichdotdev/lich/$ref
base=$raw/docs/hooks/fixtures

for file in session-start.jsonl session-state.jsonl session-title.jsonl \
  session-touched.jsonl mod-usage.jsonl mod-control.jsonl \
  mod-status.json; do
  curl -fsSL "$base/$file" -o "$here/fixtures/$file"
  echo "refreshed $file at $ref"
done

# mod-commands' prompt examples became notification envelopes in lich's merge
# commit 1f4166bf (feat/request-envelope), in no release yet, so it is read at
# that commit. Once a release ships it, move tests/lich-ref to that release and
# put the file back in the loop above.
unreleased=1f4166bf61a4cd91ef91c7811f35fa8d17c0016a
curl -fsSL "https://raw.githubusercontent.com/lichdotdev/lich/$unreleased/docs/hooks/fixtures/mod-commands.json" \
  -o "$here/fixtures/mod-commands.json"
echo "refreshed mod-commands.json at $unreleased (unreleased)"

# subagent-cards is a contract of its own, merged in lich at d33b02a8 and in no
# release yet, so it is read at that commit. Once a release ships it, move
# tests/lich-ref to that release and put the file back in the loop above.
unreleased=d33b02a87e4ea8b3a171cb57e56e1f8a81426c05
curl -fsSL "https://raw.githubusercontent.com/lichdotdev/lich/$unreleased/docs/hooks/fixtures/subagent-cards.jsonl" \
  -o "$here/fixtures/subagent-cards.jsonl"
echo "refreshed subagent-cards.jsonl at $unreleased (unreleased)"

# validate.mjs reads its token sets off this copy, so a token lich adds reaches
# the validator by moving tests/lich-ref, not by hand.
curl -fsSL "$raw/themes/template.json" -o "$here/../skills/theme/template.json"
echo "refreshed skills/theme/template.json at $ref"
