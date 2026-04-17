function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  const candidates = [record.error, record.message, record.detail];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

export async function parseCiscoResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const payload = await response.json().catch(() => null);
  const message = extractMessage(payload) || fallbackMessage;

  if (!response.ok) {
    throw new Error(message);
  }

  const record =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;

  if (record?.success === false) {
    throw new Error(message);
  }

  return payload as T;
}
