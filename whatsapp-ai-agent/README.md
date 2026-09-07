# WhatsApp AI agent

A WhatsApp agent you deploy to Vercel. Incoming messages are answered by any model on OpenRouter, and the deployment's own page is where you connect the number, write the prompt, and read the conversations.

No process has to stay running on your machine. Once deployed, the app sets its own webhook URL.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhookmyapp%2Ftemplates%2Ftree%2Fmain%2Fwhatsapp-ai-agent)

## Set it up with an AI agent

[SETUP.md](./SETUP.md) is a setup prompt for your coding agent. It installs the skills, clones this template, creates your HookMyApp key over email, writes the env file and starts the app. You supply an email and a 6-digit code, then sign in to OpenRouter to connect your account without copying a key.

## Heads up

The page has no login. Anyone with the URL can read the conversations and change the prompt. Before you point it at a real number, either turn on Vercel Deployment Protection or add auth of your own.

The keys you paste into Settings are stored as plain text in your own database, which is also where the channel token lives. Treat that database as a secret.

## What you need

Install Node.js 24 or newer and Git. The local app needs no separate database. Deployments need one environment variable:

| Value | Where it comes from |
| --- | --- |
| `DATABASE_URL` | A Neon Postgres connection string |

Locally you can skip it. With no `DATABASE_URL`, the app runs a Postgres of its own that keeps its data in `.pglite`, so there is no database account to create and nothing to install. A deployment needs the real thing, because its filesystem does not survive.

The rest you paste into **Settings** on the deployed page, where they are stored in that database:

| Value | Where it comes from |
| --- | --- |
| HookMyApp API key | An `hmok_` key from hookmyapp.com |
| Workspace id | The `ws_` id the channels live in |
| OpenRouter key | openrouter.ai/keys |

They can also be set as `HOOKMYAPP_API_KEY`, `HOOKMYAPP_WORKSPACE_ID` and `OPENROUTER_API_KEY` environment variables. A value saved in Settings wins.

Running locally, `npm run connect` fetches the first two for you. It emails you a code, exchanges it for a key, and writes both into `.env.local`. Nothing to copy from a dashboard.

## First run

1. Open the deployment and go to **Settings**. The tables are created on the first request.
2. Paste your HookMyApp credentials and save. In **Instructions**, press **Connect OpenRouter** to sign in and save your OpenRouter key automatically, or choose **Enter Key Manually** to paste a key in Settings.
3. In **Connection**, pick **Sandbox number** to try it without a Meta account. Send the code shown to the sandbox number from WhatsApp, then press **Receive messages here**.
4. Or pick **Real number** to use a number you already connected, or to connect a new one through the Meta signup flow.
5. In **Instructions**, write what the agent should be. It applies to the next message. There is no redeploy.
6. Message the number. The reply and the conversation appear under **Conversations**.

## Running it locally

These commands work in macOS Terminal, Windows PowerShell or Command Prompt, and Linux:

```sh
git clone https://github.com/hookmyapp/templates.git
cd templates/whatsapp-ai-agent
npm ci
npm run dev
```

Open the URL printed by the server. No `.env.local` file is needed to start. Enter credentials in Settings, or run `npm run connect` before starting to create your HookMyApp account by email. Settings and conversations stay on this computer in `.pglite`; a fresh installation starts empty.

The local receiver supports macOS on Intel or Apple Silicon, Windows x64, and Linux x64 or ARM64. It downloads its connection helper on first use, so an internet connection is required. Windows ARM64 is not verified. Use Node.js 24 or newer on every platform.

`npm install` also installs the HookMyApp CLI into this project, so there is nothing to install globally:

```sh
npm run hookmyapp -- channels list
npm run skills
```

The optional standalone CLI workflow needs `npm run hookmyapp -- login`. The app’s **Receive messages here** button uses the credentials saved in Settings.

Leave `DATABASE_URL` unset and the app uses its own built-in Postgres, stored in `.pglite`. Set it to a Neon connection string for a hosted database. A regular Postgres server requires a compatible HTTP adapter; a connection string alone is not enough. Any port works, the app reads its own address from the request.

Only one process can hold the built-in database, so a second `npm run dev` on the same folder waits instead of starting. Stop the first one, or point `DATABASE_URL` at a real Postgres to run several at once.

Press **Receive messages here** on the number you want to use. Locally, that starts the receiver with the HookMyApp key and workspace saved in Settings—no separate CLI login. The app shows **Receiving messages here** after the CLI configures the receiver and the app verifies its local webhook. Use **Stop receiving** to stop the local receiver.

On a deployment, the same button points the number's webhook at the app directly. `PUBLIC_URL` is only needed when your setup rewrites the host.

For a separate terminal workflow, `npm run tunnel` still uses your CLI's own login and default workspace; run `npm run hookmyapp -- login` first. It defaults to port 3000; use `npm run tunnel -- --port 3001` to match a different app port.

## How it works

```
WhatsApp -> HookMyApp -> POST /api/webhook/whatsapp
  verify the signature
  reply 200
  then: store the message, ask OpenRouter, send the answer back, store it
```

The 200 goes out before the model is called, because the model takes seconds and the delivery is only waiting for an acknowledgement.

| File | What lives there |
| --- | --- |
| `lib/hookmyapp.ts` | Every call to the HookMyApp API, and the send helper |
| `lib/llm.ts` | The OpenRouter call |
| `lib/whatsapp.ts` | Signature verification and payload parsing |
| `lib/db.ts` | Schema, settings, message history |
| `app/api/webhook/whatsapp/route.ts` | The receive and answer loop |
| `app/api/playground/route.ts` | The Playground, which answers without touching WhatsApp |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app |
| `npm run tunnel` | Start a receiver from a terminal using your separate CLI login |
| `npm run connect` | Get a HookMyApp key by email and write it to `.env.local` |
| `npm run hookmyapp -- <args>` | The HookMyApp CLI, installed with the project |
| `npm run skills` | Add the HookMyApp skills to your AI agent |

## Making it yours

- **Answer differently**: `lib/llm.ts` is one function. Give it tools, retrieval, or a second model.
- **Remember more or less**: `history()` in `lib/db.ts` returns the last 20 messages.
- **Handle images, buttons, or templates**: `parseInbound` in `lib/whatsapp.ts` keeps text and drops the rest. Extend it, then extend the send helper.
- **Answer only some messages**: the loop in the webhook route is a plain `for`. Put your condition there.

## License

MIT

## Development checks

CI checks clean installs, lint, types, tests, builds, and a fresh app startup on Windows, macOS, and Linux using Node.js 24.

Run `npm run lint`, `npm run typecheck`, and `npm test` before submitting changes. `npm run smoke` checks a production build in a clean checkout and refuses to run against existing local settings or data. Tests use mocked services and an in-memory database; they do not send WhatsApp messages or require account keys.

User-facing errors are defined in `lib/errors.ts`. Only these messages may be returned to the interface or stored as conversation errors. Keep provider bodies, command output, credentials, and internal addresses out of messages. Use `reportError` for server diagnostics and `requestJson` for browser requests.
