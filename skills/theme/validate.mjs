#!/usr/bin/env node
// Checks a lich theme against the rules internal/themes/themes.go enforces on
// import, so a rejection lands here instead of in the middle of the user's
// import. A directory is checked as a theme repository: its lich-theme.json
// manifest plus every theme beside it, the same way an install reads it.
//
// Usage: node validate.mjs my-theme.json
//        node validate.mjs my-lich-themes/
import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { basename, dirname, extname, join } from "node:path"

// The token sets come from the shipped template so this stays in step with it.
const template = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "template.json"), "utf8"),
)
const APP = Object.keys(template.app)
const TERMINAL = Object.keys(template.terminal)

const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/
const APP_COLOR =
  /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([0-9a-zA-Z.,%/ +-]*\))$/
const HEX = /^#[0-9a-fA-F]{3,8}$/
const RELEASE = /^v?\d+\.\d+\.\d+$/
const RESERVED = ["light", "dark", "system", "match"]
const WINDOWS_DEVICES = [
  "con", "prn", "aux", "nul",
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]
// The newest theme file format lich reads; FormatVersion in internal/themes.
const FORMAT_VERSION = 1
// The highlighting tags a syntax key may name, @lezer/highlight's vocabulary as
// godemirror's tags.Parse reads it, and the modifiers that wrap one.
const TAG_NAMES = new Set([
  "angleBracket", "annotation", "arithmeticOperator", "atom", "attributeName",
  "attributeValue", "bitwiseOperator", "blockComment", "bool", "brace", "bracket",
  "changed", "character", "className", "color", "comment", "compareOperator", "content",
  "contentSeparator", "controlKeyword", "controlOperator", "definitionKeyword",
  "definitionOperator", "deleted", "derefOperator", "docComment", "docString",
  "documentMeta", "emphasis", "escape", "float", "heading", "heading1", "heading2",
  "heading3", "heading4", "heading5", "heading6", "inserted", "integer", "invalid",
  "keyword", "labelName", "lineComment", "link", "list", "literal", "logicOperator",
  "macroName", "meta", "modifier", "moduleKeyword", "monospace", "name", "namespace",
  "null", "number", "operator", "operatorKeyword", "paren", "processingInstruction",
  "propertyName", "punctuation", "quote", "regexp", "self", "separator", "squareBracket",
  "strikethrough", "string", "strong", "tagName", "typeName", "typeOperator", "unit",
  "updateOperator", "url", "variableName",
])
const TAG_MODIFIERS = ["definition", "constant", "function", "standard", "local", "special"]
const FONT_STYLES = ["bold", "italic", "underline", "strikethrough"]
// The bundled themes' schemes, which a custom theme may name as its pair.
const BUNDLED_SCHEMES = { light: "light", dark: "dark" }
const MANIFEST = "lich-theme.json"
const MAX_THEMES = 32

const target = process.argv[2]
if (!target) {
  console.error("usage: node validate.mjs <theme.json | repository-directory>")
  process.exit(2)
}

function formatVersionError(document) {
  const version = document.formatVersion
  // lich decodes an omitted or null formatVersion to 0, and reads 0 as 1.
  if (version === undefined || version === null) return null
  if (!Number.isInteger(version) || version < 0)
    return `theme formatVersion ${JSON.stringify(version)} must be a positive integer`
  if (version > FORMAT_VERSION)
    return `theme format ${version} is newer than this lich reads (up to ${FORMAT_VERSION}); update lich`
  return null
}

// lich replaces a written source on install, so its contents are never checked;
// only one that does not decode into {url, version} fails, as a parse error.
function sourceDecodes(source) {
  if (source === undefined || source === null) return true
  if (typeof source !== "object" || Array.isArray(source)) return false
  const decodesToString = (value) => value === undefined || value === null || typeof value === "string"
  return decodesToString(source.url) && decodesToString(source.version)
}

// tagError is tags.Parse's verdict on a syntax key: a tag name, or a modifier
// wrapping one, as in definition(propertyName).
function tagError(expr) {
  const open = expr.indexOf("(")
  if (open < 0) {
    if (expr.includes(")")) return `"${expr}" closes a parenthesis it never opened`
    return TAG_NAMES.has(expr) ? null : `"${expr}" is not a highlighting tag`
  }
  const modifier = expr.slice(0, open)
  if (!TAG_MODIFIERS.includes(modifier))
    return `"${modifier}" in "${expr}" is not a tag modifier: want one of ${TAG_MODIFIERS.join(", ")}`
  if (!expr.endsWith(")")) return `"${expr}" must end with the parenthesis its modifier opens`
  return tagError(expr.slice(open + 1, -1))
}

function syntaxErrors(syntax) {
  if (syntax === undefined || syntax === null) return []
  if (typeof syntax !== "object" || Array.isArray(syntax))
    return ["syntax must be an object of tag styles"]
  const errors = []
  for (const [tag, entry] of Object.entries(syntax)) {
    const style = typeof entry === "string" ? { color: entry } : entry
    if (!style || typeof style !== "object" || Array.isArray(style)) {
      errors.push(`syntax.${tag} must be a color or a style object`)
      continue
    }
    const problem = tagError(tag)
    if (problem) errors.push(`syntax: ${problem}`)
    const color = String(style.color ?? "").trim()
    if (!color) {
      if (!FONT_STYLES.some((font) => style[font] === true))
        errors.push(`syntax.${tag} sets no color and no font style`)
    } else if (!APP_COLOR.test(color) || color.length > 128) {
      errors.push(`syntax.${tag} is not an accepted color value: ${JSON.stringify(style.color)}`)
    }
  }
  return errors
}

// pairErrors is what one file can tell about its pair. Whether a sibling it
// names has the other scheme is checked with the repository's themes.
function pairErrors(theme) {
  const pair = theme.pair
  if (pair === undefined || pair === null || pair === "") return []
  if (pair === theme.id) return [`theme "${theme.id}" cannot be its own pair`]
  if (typeof pair !== "string" || !ID.test(pair)) return [`pair: id ${JSON.stringify(pair)} must match ${ID}`]
  if (BUNDLED_SCHEMES[pair] === theme.scheme)
    return [`pair "${pair}" is a ${theme.scheme} theme too; a pair has the other scheme`]
  return []
}

function themeErrors(theme) {
  const errors = []
  const format = formatVersionError(theme)
  if (format) errors.push(format)
  if (!ID.test(theme.id ?? "")) errors.push(`id ${JSON.stringify(theme.id)} must match ${ID}`)
  if (RESERVED.includes(theme.id)) errors.push(`id "${theme.id}" is bundled or reserved`)
  if (WINDOWS_DEVICES.includes(theme.id)) errors.push(`id "${theme.id}" is a Windows device name`)
  if (!theme.name?.trim()) errors.push("name is required")
  if ([...(theme.name ?? "")].length > 128) errors.push("name cannot exceed 128 characters")
  if (theme.scheme !== "light" && theme.scheme !== "dark")
    errors.push('scheme must be "light" or "dark"')
  if (!sourceDecodes(theme.source))
    errors.push("parse theme JSON: source must be an object whose url and version are strings")

  const checkColors = (group, allowed, pattern, requireAll) => {
    const colors = theme[group]
    if (!colors || typeof colors !== "object") return errors.push(`${group} colors are required`)
    for (const [key, value] of Object.entries(colors)) {
      if (!allowed.includes(key)) errors.push(`unknown ${group} color "${key}"`)
      else if (!pattern.test(String(value).trim()) || String(value).trim().length > 128)
        errors.push(`${group}.${key} is not an accepted color value: ${JSON.stringify(value)}`)
    }
    for (const key of requireAll ?? []) {
      if (!colors?.[key]?.trim()) errors.push(`${group}.${key} is required`)
    }
  }
  checkColors("app", APP, APP_COLOR, APP)
  checkColors("terminal", TERMINAL, HEX, ["background", "foreground"])
  errors.push(...syntaxErrors(theme.syntax), ...pairErrors(theme))
  return errors
}

function read(path) {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")) }
  } catch (error) {
    const reason = error.code === "ENOENT" ? "not found" : error.message
    return { error: `${basename(path)}: ${reason}` }
  }
}

function checkTheme(path) {
  const { value, error } = read(path)
  return error ? [error] : themeErrors(value).map((problem) => `${basename(path)}: ${problem}`)
}

// A repository is checked the way an install reads it: the manifest first, then
// every other root-level JSON as a theme. lich renames them to <id>.json when it
// stores them, so the names in here are the author's business — the ids are not.
function checkRepository(dir) {
  const manifest = read(join(dir, MANIFEST))
  if (manifest.error) return [`${manifest.error} — every theme repository needs one at its root`]
  const errors = []
  const format = formatVersionError(manifest.value)
  if (format) errors.push(`${MANIFEST}: manifest: ${format}`)
  if (!manifest.value.name?.trim()) errors.push(`${MANIFEST}: name is required`)
  if ([...(manifest.value.name ?? "")].length > 128)
    errors.push(`${MANIFEST}: name cannot exceed 128 characters`)
  if (!RELEASE.test(manifest.value.version ?? ""))
    errors.push(
      `${MANIFEST}: version ${JSON.stringify(manifest.value.version)} must be MAJOR.MINOR.PATCH`,
    )
  // Only the shape: whether the running lich is new enough is lich's call.
  const minimum = manifest.value.minLichVersion
  if (minimum !== undefined && minimum !== "" && !RELEASE.test(minimum))
    errors.push(
      `${MANIFEST}: manifest minLichVersion ${JSON.stringify(minimum)} must be MAJOR.MINOR.PATCH`,
    )

  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory() && entry.name !== MANIFEST && extname(entry.name) === ".json")
    .map((entry) => entry.name)
    .sort()
  if (files.length === 0) errors.push(`no theme JSON next to ${MANIFEST}`)
  if (files.length > MAX_THEMES) errors.push(`more than ${MAX_THEMES} themes in one repository`)

  const seen = new Map()
  const schemes = new Map()
  for (const name of files) {
    const path = join(dir, name)
    errors.push(...checkTheme(path))
    const { value } = read(path)
    const id = value?.id
    if (!id) continue
    if (seen.has(id)) errors.push(`${name}: id "${id}" is already used by ${seen.get(id)}`)
    else seen.set(id, name)
    schemes.set(id, value.scheme)
  }
  // lich lists a theme whose pair has its own scheme as one that can't load.
  for (const name of files) {
    const { value } = read(join(dir, name))
    if (value?.pair && value.pair !== value.id && schemes.get(value.pair) === value.scheme)
      errors.push(`${name}: pair "${value.pair}" is a ${value.scheme} theme too; a pair has the other scheme`)
  }
  return errors
}

const isDirectory = statSync(target).isDirectory()
const errors = isDirectory ? checkRepository(target) : checkTheme(target)

if (errors.length) {
  console.error(`${target}: ${errors.length} problem(s)`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(
  isDirectory
    ? `${target}: ok — install it from Settings › Appearance › Import, pasting this path`
    : `${target}: ok — install it from Settings › Appearance › Import › Choose file`,
)
