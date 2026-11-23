// The one module hooks/hooks.json names under `modules`: Claude Code takes a
// single entry there, so each mod lives in a file of its own and is registered
// from here.

import { register as registerCompacting } from "./mod-compacting.js"
import { register as registerEditGuard } from "./edit-guard.js"
import { register as registerModControl } from "./mod-control.js"
import { register as registerModStatus } from "./mod-status.js"
import { register as registerModUsage } from "./mod-usage.js"
import { register as registerSelfCommand } from "./self-command.js"
import { register as registerStatusLine } from "./status-line.js"

/** @param {import('claude-code').On} on */
export function register(on) {
  registerModControl(on)
  registerModUsage(on)
  registerEditGuard(on)
  registerModStatus(on)
  registerCompacting(on)
  registerSelfCommand(on)
  registerStatusLine(on)
}
