---
name: extension
description: Write, develop and publish a lich extension, a separate Go program that draws its own screens in lich's window. Run it by hand when you want to start an extension from the template, shape its manifest, permissions and translations, try it in place, tag a release, or list it in the catalog.
disable-model-invocation: true
user-invocable: true
---

# lich extensions

An extension is a compiled Go program that lich starts with its backend and talks
to over JSON lines on stdin and stdout. It sends a tree of components for a
surface (a screen in the window) and lich draws it with its own UI kit. lich
never clones or builds source: what it runs is a release archive.

The contract is `docs/extensions.md` in the lich repository, and it is the source
of truth for everything below:
<https://github.com/lichdotdev/lich/blob/main/docs/extensions.md>

Read it before answering a question this file only points at, and never type a
component, a method or a limit from memory. This skill is the order of the work
and the traps; the tables stay in that file.

## Ask this first: new extension, or an existing one?

**Ask the user which one they are doing** unless they already said. A new one
starts at "Start from the template". An existing one starts at whichever step
they are stuck on, and the checklist at the end says what is still open.

## Start from the template

Work in the user's own directory, not in the lich checkout. The template
repository carries a manifest, a Go module and a release workflow that already
builds the archives lich installs:

```bash
gh repo create <name> --template lichdotdev/extension-template --public --clone
cd <name>
```

`<name>` is the repository, and the extension's `id` is a separate choice, set in
the manifest. Keep them equal unless there is a reason not to: the release
archive is named after the `id`.

Without `gh`, use the repository's **Use this template** button on GitHub, or
clone it and drop `.git`.

## The manifest

`manifest.json` at the root. A first one:

```json
{
  "formatVersion": 1,
  "id": "hello",
  "name": "Hello",
  "description": "Says hello from a screen in lich.",
  "version": "0.1.0",
  "executable": "hello",
  "surfaces": [{ "id": "main", "title": "Hello", "icon": "hand" }],
  "permissions": []
}
```

The rules that fail an install:

- `id` is lowercase letters, digits, dots, underscores or dashes, starts with a
  letter or digit, at most 64 long, and **equals the directory name**.
- `executable` resolves inside the directory to a regular file, symlinks
  included. On Windows it names the `.exe`.
- `version` is `MAJOR.MINOR.PATCH`.
- `description` is one line of at most 160 characters saying what the extension
  does for the person using it. lich runs one without it; the catalog does not
  list it.
- A surface's `place` is none (a full screen from the top bar), `dock` or
  `panel`. Set `minLichVersion` when the extension needs something only a recent
  lich has.
- A name in `permissions` this lich does not know makes the manifest invalid.

An extension that fails the checks is listed with its error and never started.
Surface fields, `iconFile` and the rest: the manifest section of the docs.

## The Go SDK

Import `github.com/lichdotdev/lich/extension` rather than writing the JSON by
hand. The SDK has the component builders, the message types and `extension.Conn`,
the loop that correlates call ids and hands every other message from lich over
`Messages()`. Exit when `Messages()` closes: lich closed stdin and kills the
process 3 seconds later.

Three things to get right from the first commit:

- Stdout is the protocol. A stray `fmt.Println` corrupts it; log to stderr, which
  lich writes to its own log.
- A call is refused unless the manifest lists the permission its method names.
  List exactly what the extension uses, no more: the install confirmation shows
  the person one line per permission, and `sessions:write` is set apart there.
- Any exit lich did not ask for is a crash, exit 0 included.

The permission table, every method and the limits lich enforces are in the docs
under Calling lich and What lich enforces.

## Keeping data

Anything the extension saves goes in the directory named by
`LICH_EXTENSION_DATA` (`extension.DataDirEnv`), never next to the executable: an
update replaces the extension's own directory whole. The data directory survives
updates and a remove, so the next version of the same id finds what the last one
saved.

## Translating

Ship catalogs beside the manifest, in the format lich uses for its own screens:
`locales/<tag>/<namespace>.json`. Write `en` first and every other language from
it. lich reads the name and each surface's title from the `extension` namespace
(`manifest.name`, `manifest.description`, `manifest.surfaces.<id>.title`), and
tells the extension the interface language through `LICH_LANGUAGE` and the
`language` message. Everything else the extension draws, it looks up itself with
`github.com/lichdotdev/lich/extension/i18n`.

Ask which languages the user wants before writing any. The tags lich ships are in
the docs, under Translating an extension.

## Developing in place

Link the working directory into the extensions directory instead of installing
the same code again after every edit. The link's name is the extension's id:

| OS | Directory |
|---|---|
| Linux | `${XDG_CONFIG_HOME:-$HOME/.config}/lich/extensions/` |
| macOS | `~/Library/Application Support/lich/extensions/` |
| Windows | `%AppData%\lich\extensions\` |

A lich started with `LICH_DEV` reads `extensions-dev/` in the same place, which is
the one to link into when the user develops against a development build of lich
and the safe one when they would rather not touch the extensions they use.

```bash
ln -s "$PWD" "${XDG_CONFIG_HOME:-$HOME/.config}/lich/extensions-dev/<id>"
```

Build the executable the manifest names, then restart lich: an extension added or
edited by hand is read at startup. Do not write into the extensions directory
any other way, and never into one lich installed (it has a `.lich-source.json`).

## Check before you ship

```bash
lich extension check dist/<id>_linux_amd64.tar.gz
lich extension check .
```

It runs the install's own checks on an archive or on a folder, installs nothing,
and exits non-zero naming what fails. Run it on **every** archive the release
carries, not only the one for this machine.

## Release

lich installs a repository's latest release: the newest one that is neither a
draft nor a pre-release, tagged `MAJOR.MINOR.PATCH` (with or without a leading
`v`). A repository whose tags are not versions is never offered as an update. It
carries:

- one `<id>_<goos>_<goarch>.tar.gz` per platform, holding `manifest.json` and the
  executable at its root, no top-level folder, no symlinks;
- `checksums.txt` in the `sha256sum` format.

The template's workflow builds and uploads both when a tag is pushed. Bump
`version` in the manifest in the same commit as the change, then tag it, and
**ask the user before pushing the tag**: a release is public.

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

An update has to ship the same `id`, and a new permission makes lich ask the
person again, so say so in the release notes when one is added.

## Listing in the catalog

The catalog is what the site and lich's Settings show. A repository is listed
when it is public, neither a fork nor archived, its latest release is published as
above, every archive passes `lich extension check`, the manifest sets
`description`, and its `id` is not listed from another repository. An `id`
starting with `lich` is kept for `lichdotdev`.

What the catalog shows besides the manifest comes from a `listing/` folder at the
root of the repository, read at the commit the release tag points to:

```
listing/
  listing.json
  cover.png
  screenshots/board.png
```

```json
{
  "categories": ["issues", "git"],
  "cover": "cover.png",
  "screenshots": [{ "file": "screenshots/board.png", "alt": "Board with issues grouped by state" }]
}
```

`categories` is one or two of `agents`, `git`, `issues`, `notes`, `services`,
`tools`. `cover` and `screenshots` are optional and have size, ratio and count
limits (16:10 images, `alt` required on each screenshot), all in the docs under
What the catalog shows. Without `listing/listing.json` the extension is listed
under `tools`, with no pictures. Tag the release **after** `listing/` is
committed: it is read at the tag.

Then ask for the listing with one line in a pull request on
`lichdotdev/extensions`: add `"<owner>/<repo>"` to `extensions.json`. Its checks
run on your latest release and say what fails. A maintainer approves the first
listing; each release after it is picked up within an hour with no person. Open
the pull request only when the user asks.

The catalog records each version's archive checksums the first time it sees them
and never changes them, so a release is not something to re-upload. Ship a new
version instead.

## Checklist

- [ ] The user was asked new or existing, or had already said
- [ ] Working in the user's own directory, not the lich checkout
- [ ] `id` equals the directory name, `version` is `MAJOR.MINOR.PATCH`,
      `description` is one line of at most 160 characters
- [ ] `permissions` lists what the extension calls, and nothing it does not
- [ ] Nothing but the protocol on stdout; saved data goes in `LICH_EXTENSION_DATA`
- [ ] `locales/en` written first, then each language the user asked for
- [ ] Tried in place through a link, after a restart of lich
- [ ] `lich extension check` passes on every archive
- [ ] `listing/` committed before the tag, when it is going in the catalog
- [ ] Tag pushed only after the user said so; catalog pull request likewise
