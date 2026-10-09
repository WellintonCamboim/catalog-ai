const GENERIC = 'Não foi possível obter a resposta do agente';
const RATE_LIMITED = 'O provedor de IA atingiu o limite de uso. Tente novamente em alguns minutos.';

// Turns an upstream LLM failure into a message that is safe to show to the user: never the raw
// provider error, but distinguishing the one case they can act on (waiting out a rate limit).
export function userMessageForLlmError(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 429 ? RATE_LIMITED : GENERIC;
}
