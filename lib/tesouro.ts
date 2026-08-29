// Tesouro Transparente client — the second (and last) place in the app that
// talks to a quote provider.
//
// Role in the architecture: deliberately dumb, exactly like lib/yahoo.ts. It
// knows how to pull the Tesouro's daily price file off the wire and nothing
// else — it does not even parse it. Every decision about the content (which
// rows are current, which bond a row is, how to turn "2458,57" into cents)
// lives in lib/quotes.ts, where it is unit-tested against a fixture with no
// network involved.
//
// This module is SERVER-ONLY. Its only importer is a "use server" file.
//
// About the source (see ADR-011): this is Brazilian government open data,
// published through a CKAN portal. No key, no signup, no rate limit, and one
// request carries every bond — an easier provider than Yahoo in every respect
// but one, which is the file's size.
//
// Three things learned by testing the live endpoint (2026-08-29):
//   * The file is the WHOLE history, 13.8 MB, and it is served newest-first.
//     The ~58 bonds of the most recent date fit in the first ~4 KB.
//   * A Range request is NOT honoured: `curl -r 0-600` downloaded all 13.8 MB.
//     There is no Content-Length either (the response is chunked), so the only
//     way to avoid pulling the whole thing is to read the first chunks and
//     CANCEL the stream — which is what this module does, in ~0.14 s.
//   * Unlike Yahoo, no User-Agent gymnastics are needed; the header below is
//     sent to be a good citizen, not to get past a check.

const TESOURO_PRICE_FILE_URL =
  'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv'

// An honest identifier, same as the Yahoo client sends.
const USER_AGENT = 'finance-hub/1.0 (personal portfolio app)'

// How much of the file to read before hanging up. The most recent date needs
// ~4 KB; 32 KB is roughly 400 rows, about a week of history — eight times the
// margin needed, and still 0.4% of the file.
const MAX_BYTES = 32 * 1024

// A hung provider must not hold the Server Action open forever.
const TIMEOUT_MS = 8000

/**
 * Raised when the price file cannot be read at all (network down, portal
 * moved the resource, server error). There is no per-bond failure here: it is
 * one file, so it either arrives or it doesn't.
 *
 * The message is user-facing Portuguese — it is shown as-is under the button.
 */
export class TesouroError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TesouroError'
  }
}

/**
 * True when the error came from this module, i.e. its message is already a
 * finished sentence for the user.
 *
 * Duck-typed on `name` rather than `instanceof`, the same defensive choice
 * isYahooError and isPrismaError make: `instanceof` across a module boundary is
 * one bundling accident away from silently returning false.
 *
 * @param error - Anything caught in a try/catch.
 */
export function isTesouroError(error: unknown): error is TesouroError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'TesouroError'
  )
}

/**
 * Downloads the beginning of the Tesouro's daily price file and returns it as
 * text, for lib/quotes.parseTesouroPrices to interpret.
 *
 * Only the first MAX_BYTES are read; the connection is then cancelled. The last
 * line of the result is therefore usually TRUNCATED — the parser drops any row
 * that does not have all its fields, which handles that without a special case.
 *
 * @returns The first chunk of the CSV, including its header row.
 * @throws TesouroError when the file cannot be read.
 */
export async function fetchTesouroPriceFile(): Promise<string> {
  let response: Response
  try {
    response = await fetch(TESOURO_PRICE_FILE_URL, {
      headers: { 'User-Agent': USER_AGENT },
      // The point of the button is to read today's prices, not a cached copy.
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'TimeoutError' ? 'demorou demais' : 'falhou'
    throw new TesouroError(
      `Não foi possível falar com o Tesouro Direto (a conexão ${reason}). Verifique sua internet e tente de novo.`,
    )
  }

  if (!response.ok) {
    throw new TesouroError(
      `O portal do Tesouro Direto respondeu com erro ${response.status}.`,
    )
  }

  if (response.body === null) {
    throw new TesouroError('O portal do Tesouro Direto respondeu sem conteúdo.')
  }

  // Read chunk by chunk and stop early. Reading response.text() would pull all
  // 13.8 MB for the ~4 KB actually needed.
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let text = ''
  let bytes = 0

  try {
    while (bytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      // stream: true keeps a multi-byte character split across two chunks from
      // being decoded as garbage.
      text += decoder.decode(value, { stream: true })
    }
  } catch {
    throw new TesouroError(
      'A conexão com o Tesouro Direto caiu no meio do download. Tente de novo.',
    )
  } finally {
    // Hangs up the connection. Without this the rest of the file keeps coming.
    await reader.cancel().catch(() => {})
  }

  if (text.trim() === '') {
    throw new TesouroError('O portal do Tesouro Direto devolveu um arquivo vazio.')
  }

  return text
}
