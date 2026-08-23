<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on templates in this repository

The templates are the product here. They live one JSON file per template in `templates/`, named `<name>.<language>.json`, and the file is the source of truth. There is no database and nothing to sync.

## Before you change a template

Read `lib/core/validate.ts`. It holds every rule Meta applies, each with a stable id like `body.placeholders.gap`, and it is the fastest way to know whether an edit is legal. Run `npm run check` after any edit: it validates every file in `templates/` and fails on anything that would be rejected.

Rules that catch people out, and that you will not guess:

- The body cannot begin or end with a placeholder, and two placeholders cannot sit next to each other.
- Numbered placeholders run 1, 2, 3 with no gaps. Renumbering a body means renumbering its samples too, or the count no longer matches.
- A URL button takes one placeholder and only at the very end of the address.
- Quick replies have to form one unbroken run. Interleaved with other buttons the submission fails with nothing useful to say.
- An authentication body has no text. Meta writes the wording, and the template only chooses the security line, the expiry and the OTP button.
- Every card in a carousel has to be built the same way as the first: same components, same media type, same buttons in the same order.

## Notes left for you

`comments.json` is an inbox. Each entry is a request from whoever was looking at a template:

```json
{
  "id": "c_foyf6u",
  "template": "order_update.en_US",
  "quote": "Hi Sam, order A-1024 is now out for delivery.",
  "body": "Too formal. Say on its way rather than out for delivery.",
  "status": "open",
  "created": "2026-08-23T06:04:04.936Z"
}
```

`quote` is what was highlighted on the page when the note was written, so it says which line is meant. `status` is `open` until it is dealt with.

When asked to work through the notes:

1. Read `comments.json` and take the entries whose `status` is `open`.
2. Change the template file the note names. Nothing else.
3. Run `npm run check`.
4. Set that entry's `status` to `"done"` and add what you did:

```json
"answered": { "at": "2026-08-23T07:10:00.000Z", "note": "Rewrote the body and the {{3}} sample to say on its way." }
```

Leave a note `open` if you could not do what it asks, and say why in the same `answered.note`. Silently closing a note is worse than leaving it.

## Adding a rule

A rule Meta enforces that we do not check yet belongs in `lib/core/validate.ts` with a test beside it in `lib/core/core.test.ts`. Give it an id in the same shape as its neighbours, write the message as a sentence a person would say, and set `path` to the field it is about, because the editor uses that path to put the message under the right input.

## Adding an error code

`lib/core/decode.ts` turns what Meta said into what it meant. Its table is data: one entry, with the codes or wording it matches, the cause, the steps, and the ids of the rules that catch the same thing before submission. Adding an entry needs no new code.
