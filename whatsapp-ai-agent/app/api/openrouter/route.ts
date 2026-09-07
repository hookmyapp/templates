import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { saveSettings } from '@/lib/db';

const COOKIE = 'openrouter_verifier';
const PATH = '/api/openrouter';

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return new Response('Invalid origin', { status: 403 });
  }
  const verifier = randomBytes(32).toString('base64url');
  const callback = new URL(PATH, req.url);
  const url = new URL('https://openrouter.ai/auth');
  url.searchParams.set('callback_url', callback.href);
  url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
  url.searchParams.set('code_challenge_method', 'S256');
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(COOKIE, verifier, {
    httpOnly: true,
    secure: req.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: PATH,
    maxAge: 600,
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const verifier = req.cookies.get(COOKIE)?.value;
  const destination = new URL('/', req.url);
  destination.searchParams.set('openrouter', 'error');
  // PKCE binds the code to this browser's short-lived, HttpOnly verifier.
  if (code && verifier && !req.nextUrl.searchParams.has('error')) {
    try {
      const result = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      });
      if (!result.ok) throw new Error('OpenRouter authorization failed');
      const data = await result.json();
      if (typeof data.key !== 'string' || !data.key.trim()) throw new Error('Missing key');
      await saveSettings({ openrouter_api_key: data.key });
      destination.searchParams.set('openrouter', 'connected');
    } catch {
      // Never expose provider responses, authorization codes, or keys in errors.
    }
  }
  const response = NextResponse.redirect(destination, 303);
  response.cookies.set(COOKIE, '', { path: PATH, maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
