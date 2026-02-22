import API_BASE_URL from './api';

export default async function apiFetch(
    path: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': '1',
        ...(options.headers as Record<string, string> ?? {}),
    };

    return fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });
}
