import { createOnboardingLink, selfUrl } from '@/lib/hookmyapp';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const link = await createOnboardingLink(
      'WhatsApp AI agent',
      `${selfUrl()}/api/connected`,
    );
    return Response.json(link);
  } catch (err) {
    const message = String(err);
    // An API key without organization scope cannot mint onboarding links.
    // Say so plainly instead of surfacing a raw 403.
    if (message.includes('403')) {
      return Response.json(
        {
          error:
            'This API key cannot create connect links. Connect the number in your HookMyApp dashboard, then pick it from the list above.',
        },
        { status: 403 },
      );
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
