export type Status = {
  systemPrompt: string;
  model: string;
  temperature: number;
  mode: 'sandbox' | 'live';
  connected: boolean;
  channelId: string | null;
  sandboxSessionId: string | null;
  phoneNumberId: string | null;
  webhookUrl: string | null;
  keys: { hookmyapp: string | null; workspace: string | null; openrouter: string | null };
};
