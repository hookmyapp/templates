# Set it up with an AI agent

Paste everything below into Claude Code, Codex or Cursor, in the folder where you want this to live.

---

Set up the HookMyApp WhatsApp template manager for me.

1. Clone it and install:

   ```bash
   npx degit hookmyapp/templates/whatsapp-template-manager whatsapp-template-manager
   cd whatsapp-template-manager
   npm install
   ```

2. Start it with `npm run dev` and tell me the address.

3. Ask me whether I want it connected to a real WhatsApp Business account. If I
   do, run `npm run hookmyapp -- login`, then `npm run hookmyapp -- channels list`,
   and write `WHATSAPP_TOKEN`, `WABA_ID` and `PHONE_NUMBER_ID` into `.env.local`
   from what that prints. If I do not, skip it: everything except reading the
   account and sending a test message works without it.

4. Read `AGENTS.md` so you know how the templates and the notes in
   `comments.json` work, then tell me in two sentences what I can do from here.

Do not write any templates of your own yet. Six examples ship with it.
