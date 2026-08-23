# WhatsApp template manager

Write WhatsApp message templates, see them the way the phone will, and find out why one was rejected. The templates are JSON files in this folder, so your AI agent edits them and `git diff` shows what changed.

Meta rejects templates for rules that only appear on the way out: a variable at the end of a line, quick replies split up by a link, a tab you cannot see. Each rejection costs a day. This checks all of it while you type.

## What it does

**Checks before you submit.** Every rule Meta applies, with a plain sentence about what is wrong and what to do, pointing at the field it is in. Errors block a submission, warnings are the things that get approved and then bite.

**Draws the message properly.** Not a text box with a green border. The colours and the geometry come from the WhatsApp UI kit, so the bubble, the buttons and the carousel are the size they will really be. Authentication templates draw the wording Meta writes for you.

**Reads a rejection.** Paste the error code, the reason word, or the whole response body, and get back what it means, what to change, and which field in this template would have caused it.

**Talks to your account.** Read every template off a WhatsApp Business account, edit one, submit it back. Then send it to your own phone and look at it, because a preview is a drawing.

**Takes feedback for an agent.** Right-click a template, or highlight anything and write what should change. It lands in `feedback.json`. Claude or Codex reads that file, makes the change, and writes back what it did. [AGENTS.md](./AGENTS.md) is the protocol.

Everything Meta currently supports is modelled: authentication with one-tap and zero-tap codes, carousels, limited time offers, flow and catalog buttons, and named parameters as well as numbered ones.

## Running it

```bash
npm install
npm run dev
```

That is the whole setup. The six example templates in `templates/` all pass review as they stand, so there is something to look at immediately.

To read and write a real account, copy the environment file and fill it in:

```bash
cp .env.example .env.local
```

| Value | Where it comes from |
| --- | --- |
| `WHATSAPP_TOKEN` | An `hmat_` token from HookMyApp, or a Meta token with `whatsapp_business_management` |
| `WABA_ID` | The WhatsApp Business Account id |
| `PHONE_NUMBER_ID` | Only to send a test message |

An `hmat_` token goes through the HookMyApp gateway, which holds the Meta credentials for you. A Meta token goes straight to Graph. The app works out which from the token and does not need telling.

`npm install` also puts the HookMyApp CLI in this project, so there is nothing to install globally:

```bash
npm run hookmyapp -- login       # sign in
npm run hookmyapp -- channels list   # find your ids
npm run skills                   # add the HookMyApp skills to your AI agent
```

## Checking templates in CI

```bash
npm run check
```

Reads every file in `templates/` and fails on anything Meta would reject. Warnings are left alone, because a template being written is allowed to be unfinished. Run it in a pull request and nobody merges a template that costs a day to find out about.

## Deploying it

The templates are files, and a deployment has no writable disk, so a deployed copy is a reader: the gallery, the previews, the checks and the rejection reader all work, and saving is turned off. That is the right split. The editing half wants to sit next to your agent and your repository anyway.

## The shape of it

| Path | What is in it |
| --- | --- |
| `lib/core/` | The model, the rules and the rejection reader. No React, no dependencies, runs anywhere Node does |
| `lib/waba.ts` | Reading and writing a WhatsApp Business account |
| `lib/store.ts` | Templates and notes on disk |
| `components/preview.tsx` | The message as WhatsApp draws it |
| `templates/` | Your templates, one JSON file each |
| `feedback.json` | Feedback waiting for an agent |

`lib/core` is worth knowing about on its own. Import it in a script, a test or a deployment step and validate a template with no browser in sight:

```ts
import { validate } from "./lib/core";

const result = validate(template);
if (!result.ok) throw new Error(result.errors.map((issue) => issue.message).join("\n"));
```

## Credits

The chat surface is built from the [WhatsApp UI Kit (iOS)](https://www.figma.com/design/GN3xgOrjaoKpO1EjF7gXJI/WhatsApp-UI-Kit--iOS---Community-) Figma community file: the colours and the geometry are sampled from it, and `public/wa-wallpaper.webp` is its wallpaper export, resized. WhatsApp and the doodle wallpaper are trademarks and artwork of Meta, used here to show what a message will look like.

## Licence

MIT, for the code. The rules are read from Meta's own documentation and from what its API actually rejects, which is not always the same thing. When you meet a code we do not know, add it to `lib/core/decode.ts` and the next person will not have to work it out.
