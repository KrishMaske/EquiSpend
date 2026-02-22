import API_BASE_URL from './api';

/**
 * Wrapper around fetch() that automatically:
 * - Prepends the API_BASE_URL
 * - Adds the ngrok-skip-browser-warning header (required to bypass
 *   the ngrok free-tier interstitial page on API calls)
 * - Merges any additional headers you pass
 */
export default async function apiFetch(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': '1',       // bypass ngrok interstitial
        ...(options.headers as Record<string, string> ?? {}),
    };

    return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });
}
