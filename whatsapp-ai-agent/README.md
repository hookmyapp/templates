# WhatsApp AI agent

A WhatsApp agent you deploy to Vercel. Incoming messages are answered by any model on OpenRouter, and the deployment's own page is where you connect the number, write the prompt, and read the conversations.

No process has to stay running on your machine. Once deployed, the app sets its own webhook URL.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhookmyapp%2Ftemplates%2Ftree%2Fmain%2Fwhatsapp-ai-agent)

## Heads up

The page has no login. Anyone with the URL can read the conversations and change the prompt. Before you point it at a real number, either turn on Vercel Deployment Protection or add auth of your own.

## What you need

One environment variable to deploy:

| Value | Where it comes from |
| --- | --- |
| `DATABASE_URL` | Any Postgres. Neon has a free tier and works well on Vercel |

The rest you paste into **Settings** on the deployed page, where they are stored in that database:

| Value | Where it comes from |
| --- | --- |
| HookMyApp API key | An `hmok_` key from hookmyapp.com |
| Workspace id | The `ws_` id the channels live in |
| OpenRouter key | openrouter.ai/keys |

They can also be set as `HOOKMYAPP_API_KEY`, `HOOKMYAPP_WORKSPACE_ID` and `OPENROUTER_API_KEY` environment variables. A value saved in Settings wins.

## First run

1. Open the deployment and go to **Settings**. The tables are created on the first request.
2. Paste the three credentials and save.
3. In **Connection**, pick **Sandbox number** to try it without a Meta account. Send the code shown to the sandbox number from WhatsApp, then press **Receive messages here**.
4. Or pick **Real number** to use a number you already connected, or to connect a new one through the Meta signup flow.
6. In **Instructions**, write what the agent should be. It applies to the next message. There is no redeploy.
6. Message the number. The reply and the conversation appear under **Conversations**.

## Running it locally

```bash
npm install
cp .env.example .env.local   # DATABASE_URL is the only one you need
npm run dev
```

`DATABASE_URL` can point at a Neon database or at a Postgres on your machine. Webhooks need a public URL, so to receive messages locally, expose port 3000 through a tunnel and set `PUBLIC_URL` to that address. Connecting a number works without a tunnel.

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

## Making it yours

- **Answer differently**: `lib/llm.ts` is one function. Give it tools, retrieval, or a second model.
- **Remember more or less**: `history()` in `lib/db.ts` returns the last 20 messages.
- **Handle images, buttons, or templates**: `parseInbound` in `lib/whatsapp.ts` keeps text and drops the rest. Extend it, then extend the send helper.
- **Answer only some messages**: the loop in the webhook route is a plain `for`. Put your condition there.

## License

MIT
