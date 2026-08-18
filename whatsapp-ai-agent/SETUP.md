# Setup prompt

Paste everything below into an AI coding agent (Claude Code, Codex, Cursor). It does the setup and asks you only for browser approvals and one key.

---

Set up this WhatsApp AI agent template and deploy it. Work through the steps in order and stop to ask me whenever a browser login or a value from me is needed.

1. **Database.** Create a Postgres database with Neon, using `neonctl` or the Neon MCP server. Ask me to approve the login in the browser. Read back the connection string. Do not print it in full.

2. **HookMyApp key.** If the `hookmyapp` CLI is installed, run `hookmyapp login` and ask me to approve it. Otherwise register an agent credential over the API with email OTP and ask me for the code that arrives by email. Get the `hmok_` key and the `ws_` workspace id.

3. **OpenRouter key.** Ask me to paste a key from openrouter.ai/keys. This is the one value you cannot get yourself.

4. **Deploy.** From the `whatsapp-ai-agent` directory: `vercel link`, add `DATABASE_URL` with `vercel env add`, then `vercel deploy --prod`. Give me the deployment URL.

5. **Check it.** Open the URL, go to Settings, and tell me to paste the three credentials there. Then tell me to press the sandbox button and send the code from WhatsApp, or ask which of my connected numbers to use.

Rules: never print a secret in full, never commit a `.env` file, and stop and ask if a step fails rather than working around it.
