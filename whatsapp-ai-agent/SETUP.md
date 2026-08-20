# Setup prompt

Paste everything below the line into an AI coding agent (Claude Desktop, Claude Code, Codex, Cursor). It asks you for an email, a 6-digit code, and an OpenRouter key, and does the rest.

---

Set up the WhatsApp AI agent for me. Follow these steps:

1. Check prerequisites — you need Node.js 20 or newer (npm ships with it):
   node -v
   If node is missing or below v20, STOP and tell me to install the current LTS from https://nodejs.org, then re-run.

2. Install the HookMyApp agent skills globally so this and future agent sessions know how to finish or recover the setup:
   npx skills add hookmyapp/agent-skills --all --global
   If the command fails, continue with the steps below because they contain the full setup flow. Tell me to run the skills command once manually afterward.

3. Get the project and install it — the HookMyApp CLI comes with it, so nothing is installed globally:
   git clone https://github.com/hookmyapp/templates.git
   cd templates/whatsapp-ai-agent
   npm install

4. Create my HookMyApp key — this also creates my free HookMyApp account if I don't have one yet. Look for email addresses that are likely mine (git config user.email, prior context). If you found any, ask me: "Your free HookMyApp account needs an email address. Should I use <the email(s) you found>, or a different one?" If you found none, ask me: "To set up your free HookMyApp account I need an email address. Which one should I use?" Either way, keep it to that one question — no commands, no mention of where you looked. Once I confirm, run:
   npm run connect -- --email <my email>
   Run that initiation command exactly once. Save the registrationId it prints and do not request another code. A 6-digit code is sent to my email. Tell me: "I just sent a 6-digit sign-in code to <email> — paste it here so I can finish setting up your account." Any unexpired code sent to that same email during this 10-minute window is valid. Complete with:
   npm run connect -- --email <my email> --registration-id <the saved registrationId> --otp <the 6-digit code>
   That writes HOOKMYAPP_API_KEY and HOOKMYAPP_WORKSPACE_ID into .env.local. Never print either value in full.

5. Skip the database — running on my machine the app uses a Postgres built into the project, so there is nothing to create and nothing to ask me for. Only a deployment needs a real one.

6. Ask me for an OpenRouter key from https://openrouter.ai/keys — this is the only value you cannot obtain yourself. Add it to .env.local, keeping the two lines step 4 wrote:
   OPENROUTER_API_KEY=<my key>

7. Start it and confirm it answers:
   npm run dev
   curl -s http://localhost:3000/api/settings
   Run the server in the background and tell me the URL it prints. The app creates its own tables on the first request. In that response, connected will be false until a number is attached, which is expected. If the request fails, STOP and tell me the exact error.

8. Tell me how to finish, in this order:
   - Open the URL. The keys are already in place under Settings.
   - Under Connection, on Sandbox number, send the code shown to the sandbox number from WhatsApp. No Meta account is needed. Or switch to Real number to use a number I already have, or connect a new one through Meta sign-in.
   - To receive messages while it runs on my machine, the CLI needs its own sign-in once: npm run hookmyapp -- login. Then press Run the agent on this computer in the Connection card.
   - Deploying to Vercel needs no tunnel, and only DATABASE_URL has to be set there because the built-in database does not survive a deployment. Everything else can be pasted into Settings on the deployment.

If anything fails, STOP, preserve the registrationId, and tell me the exact error. Do not run the initiation command again or request another code unless all existing codes are expired or locked and I explicitly approve another email. Never commit .env.local and never print a key in full.
