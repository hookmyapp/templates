import { errors, publicError } from './errors';

/** UI requests never expose an upstream body, HTML error page, or network exception. */
export async function requestJson(url: string, init?: RequestInit, fallback: string = errors.load) {
  try {
    const response = await fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(90_000) });
    const data = await response.json();
    if (!response.ok) throw new Error(publicError(data?.error, fallback));
    return data;
  } catch (error) {
    throw new Error(publicError(error, fallback));
  }
}
