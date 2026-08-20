# Setup prompt

Paste everything below the line into an AI coding agent (Claude Desktop, Claude Code, Codex, Cursor). It does the whole setup and asks you only for an email, a 6-digit code, and one key.

---

Set up the HookMyApp WhatsApp AI agent for me. Follow these steps in order and stop at the first failure.

1. **Check Node.** Run `node -v`. If node is missing or below v20, STOP and tell me to install the current LTS from https://nodejs.org, then re-run this.

2. **Install the HookMyApp agent skills**, so this and future sessions know how to finish or repair the setup:

   ```
   npx skills add hookmyapp/agent-skills --all --global
   ```

   If it fails, carry on. The steps below are self-contained. Tell me to run it once by hand afterwards.

3. **Get the project.**

   ```
   git clone https://github.com/hookmyapp/templates.git
   cd templates/whatsapp-ai-agent
   npm install
   ```

   That also installs the HookMyApp CLI into the project. Nothing goes on my machine globally.

4. **Create my HookMyApp key.** This also creates my free account if I do not have one. Look for an email address that is likely mine, from `git config user.email` or earlier context. If you found one, ask: "Your free HookMyApp account needs an email address. Should I use <the address>, or a different one?" If you found none, ask: "Which email should I use for your free HookMyApp account?" Keep it to that one question. Once I answer, run this exactly once:

   ```
   curl -s -X POST https://api.hookmyapp.com/agent/auth/claim \
     -H 'Content-Type: application/json' \
     -d '{"email":"<my email>","scopes":["workspace.read","channel.connect","channel.read","channel.manage","messages.read"]}'
   ```

   Save the `registrationId` from the response. Do not request another code. Tell me: "I sent a 6-digit code to <email>, paste it here." Then:

   ```
   curl -s -X POST https://api.hookmyapp.com/agent/auth/claim/complete \
     -H 'Content-Type: application/json' \
     -d '{"registrationId":"<the saved registrationId>","otp":"<the 6-digit code>"}'
   ```

   The response carries `accessToken`, an `hmok_` key. It is shown once, so keep it for the next steps and do not print it in full.

5. **Find the workspace.**

   ```
   curl -s https://api.hookmyapp.com/workspaces -H 'Authorization: Bearer <the hmok_ key>'
   ```

   Take the `ws_` id. If there is more than one, show me the names and ask which.

6. **Get a database.** The app needs any Postgres. If `neonctl` or a Neon MCP server is available, create a project with it and read the connection string, asking me to approve the browser login. Otherwise ask me for a `DATABASE_URL`.

7. **Get an OpenRouter key.** Ask me to paste one from https://openrouter.ai/keys. This is the only value you cannot obtain yourself.

8. **Write `.env.local`** in `templates/whatsapp-ai-agent`, with real values and no placeholders:

   ```
   DATABASE_URL=<the connection string>
   HOOKMYAPP_API_KEY=<the hmok_ key>
   HOOKMYAPP_WORKSPACE_ID=<the ws_ id>
   OPENROUTER_API_KEY=<my OpenRouter key>
   ```

9. **Start it.** Run `npm run dev` in the background and tell me the URL it prints. The app creates its own tables on the first request. Confirm it answers:

   ```
   curl -s http://localhost:3000/api/settings
   ```

   `connected` will be `false` until a number is attached, which is expected.

10. **Tell me how to finish**, in this order:
    - Open the URL. Everything is already filled in under Settings.
    - Under Connection, on **Sandbox number**, send the code shown to the sandbox number from WhatsApp. No Meta account is needed.
    - To receive messages while it runs on my machine, the CLI needs its own sign-in: `npm run hookmyapp -- login`. Then press **Run the agent on this computer** in the Connection card.
    - Deploying to Vercel needs no tunnel. Only `DATABASE_URL` has to be set there; the rest can be pasted into Settings on the deployment.

Rules: never print a key in full, never commit `.env.local`, and if a step fails, STOP and tell me the exact error. Do not re-run the claim command or request a second code unless every existing code is expired or locked and I approve it.
