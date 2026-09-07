# Setup prompt

Paste everything below the line into your coding agent. It asks you for an email and a 6-digit code, then opens OpenRouter so you can connect your account without copying a key.

---

Set up the WhatsApp AI agent for me. Follow these steps:

1. Check prerequisites — you need Node.js 24 or newer (npm ships with it):
   node -v
   git --version
   If node is missing or below v24, STOP and tell me to install the current LTS from https://nodejs.org, then re-run. If Git is missing, install it from https://git-scm.com before cloning.

2. Install the HookMyApp agent skills globally so this and future agent sessions know how to finish or recover the setup:
   npx skills add hookmyapp/agent-skills --all --global
   If the command fails, continue with the steps below because they contain the full setup flow. Tell me to run the skills command once manually afterward.

3. Use the existing templates/whatsapp-ai-agent checkout if available. Preserve local changes. If there is no checkout, get the project:
   git clone https://github.com/hookmyapp/templates.git
   cd templates/whatsapp-ai-agent
   Install dependencies:
   npm ci
   The HookMyApp CLI comes with the project; it is not installed globally. Use commands native to the operating system. On Windows, use PowerShell or Command Prompt without assuming Bash is installed.

4. Create my HookMyApp key — this also creates my free HookMyApp account if I don't have one yet. Look for email addresses that are likely mine (git config user.email, prior context). If you found any, ask me: "Your free HookMyApp account needs an email address. Should I use <the email(s) you found>, or a different one?" If you found none, ask me: "To set up your free HookMyApp account I need an email address. Which one should I use?" Either way, keep it to that one question — no commands, no mention of where you looked. Once I confirm, run:
   npm run connect -- --email <my email>
   Run that initiation command exactly once. Save the registrationId it prints and do not request another code. A 6-digit code is sent to my email. Tell me: "I just sent a 6-digit sign-in code to <email> — paste it here so I can finish setting up your account." Any unexpired code sent to that same email during this 10-minute window is valid. Complete with:
   npm run connect -- --email <my email> --registration-id <the saved registrationId> --otp <the 6-digit code>
   That writes HOOKMYAPP_API_KEY and HOOKMYAPP_WORKSPACE_ID into .env.local. Never print either value in full.

5. Skip the database — running on my machine the app uses a Postgres built into the project, so there is nothing to create and nothing to ask me for. Only a deployment needs a real one.

6. Choose an unused local port and start the app in the background:
   npm run dev -- --port <free port>
   Do not assume port 3000 is available. Never stop, kill, restart, or reuse an existing server to claim its port. If the selected port becomes occupied, choose another free port. If this checkout is already running, STOP and report it rather than starting a second process against its built-in database. Use the actual URL printed by this server for every browser action and API check. Track only the server process you started so it can be stopped without affecting other servers. Check GET <app URL>/api/settings and require HTTP 200. The app creates its own tables on the first request. In that response, connected refers to the WhatsApp number; false is expected before a number is attached. Do not print credentials. If the request fails, STOP and report the error with secrets redacted.

7. Connect OpenRouter through login — do not ask me to create or paste a key by default:
   - Open the app and click Connect OpenRouter under Instructions > Model configuration.
   - Let me sign in and authorize on OpenRouter. If OpenRouter asks me to finish account onboarding, let me complete it. Onboarding alone is not a successful connection. If it ends on OpenRouter instead of returning to the app, return to the app and start Connect OpenRouter again.
   - After authorization, confirm the browser returns to the app and shows OpenRouter connected. The server exchanges the authorization code for an API key and saves it in the app's database. Do not copy it to .env.local or ask me to paste it into chat.
   - Verify GET <app URL>/api/settings has a non-null keys.openrouter, then GET <app URL>/api/models returns HTTP 200 and connected: true. Report only connection status and model count. Do not claim success before both checks pass. These checks verify the key, not available credits or a successful model reply.
   - If connection fails, inspect the callback and exchange failure without exposing codes, cookies, or keys. Report the failure; do not claim that signing in or completing onboarding saved the key.
   - Keep Enter Key Manually as an alternative if I choose it. Let me paste the key directly into Settings and save it, then run the same checks.

8. Tell me how to finish, in this order:
   - Open the URL. HookMyApp credentials are configured and OpenRouter is connected. Pick a model under Instructions; use Playground to test a reply when ready.
   - Under Connection, on Sandbox number, send the code shown to the sandbox number from WhatsApp. No Meta account is needed. Or switch to Real number to use a number I already have, or connect a new one through Meta sign-in.
   - Press Receive messages here in the Connection card. On my machine this also starts the receiver using the saved HookMyApp credentials; no separate CLI login is needed. Wait for Receiving messages here. If it fails, report the error shown; do not work around it by signing the global CLI in.
   - Deploying to Vercel needs no tunnel. Set DATABASE_URL to a real Postgres database. Local settings and keys do not transfer automatically: add HookMyApp credentials in the deployment’s Settings and connect OpenRouter again there, or enter its key manually.

Except for the optional skills installation in step 2, if anything fails, STOP, preserve the registrationId, and tell me the exact error. Do not run the initiation command again or request another code unless all existing codes are expired or locked and I explicitly approve another email. Never commit .env.local and never print a key in full.
