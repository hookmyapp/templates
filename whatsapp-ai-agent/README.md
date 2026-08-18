# WhatsApp AI agent

A WhatsApp agent you deploy to Vercel. Incoming messages are answered by any model on OpenRouter, and the deployment's own page is where you connect the number, write the prompt, and read the conversations.

No process has to stay running on your machine. Once deployed, the app sets its own webhook URL.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhookmyapp%2Ftemplates%2Ftree%2Fmain%2Fwhatsapp-ai-agent)

## Heads up

The page has no login. Anyone with the URL can read the conversations and change the prompt. Before you point it at a real number, either turn on Vercel Deployment Protection or add auth of your own.

## What you need

| Value | Where it comes from |
| --- | --- |
| `HOOKMYAPP_API_KEY` | An `hmok_` key from hookmyapp.com |
| `HOOKMYAPP_WORKSPACE_ID` | The `ws_` id the channels live in |
| `OPENROUTER_API_KEY` | openrouter.ai/keys |
| `DATABASE_URL` | Any Postgres. Neon has a free tier and works well on Vercel |

Set all four in Vercel, deploy, and open the deployment.

## First run

1. Open the deployment. The tables are created on the first request.
2. In **Connection**, pick **Sandbox number** to try it without a Meta account. Send the code shown to the sandbox number from WhatsApp, then press **Receive messages here**.
3. Or pick **Real number** to use a number you already connected, or to connect a new one through the Meta signup flow.
4. In **Prompt**, write what the agent should be. It applies to the next message. There is no redeploy.
5. Message the number. The reply and the conversation appear in **Conversations**.

## Running it locally

```bash
npm install
cp .env.example .env.local   # fill in the four values
npm run dev
```

Webhooks need a public URL, so expose port 3000 through a tunnel and set `PUBLIC_URL` to that address before pressing the connect button.

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

## Making it yours

- **Answer differently**: `lib/llm.ts` is one function. Give it tools, retrieval, or a second model.
- **Remember more or less**: `history()` in `lib/db.ts` returns the last 20 messages.
- **Handle images, buttons, or templates**: `parseInbound` in `lib/whatsapp.ts` keeps text and drops the rest. Extend it, then extend the send helper.
- **Answer only some messages**: the loop in the webhook route is a plain `for`. Put your condition there.

## Tests

```bash
npm test
```

Covers signature verification and payload parsing, the two places a silent break would let unverified traffic through. The full loop involves OpenRouter and the WhatsApp gateway, so verify it by sending a real message to the sandbox number.

## License

MIT
