const BASE_URL = "https://api.uat.private.getjoin.io"

export async function apiGet(url: string, headers: any = {}) {
    try {
        const r = await fetch(BASE_URL+url, {
            method: 'GET',
            headers:  { 'Content-Type': 'application/json', ...headers }
        });
        
        const text = await r.text();
        
        if (!r.ok) {
            throw new Error(`GET ${url} failed: ${r.status} - ${text}`);
        }
        
        const cleanText = text.trim();

        try {
            return JSON.parse(cleanText);
        } catch {
            // Some endpoints may return plain text (e.g., SIWE message)
            return cleanText;
        }
    } catch (e) {
        console.error(`API GET ${url} error:`, e);
        throw e;
    }
}

export async function apiPost(url: string, body: unknown, headers: any = {}) {
    try {
        const r = await fetch(BASE_URL+url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body)
        });
        
        const text = await r.text();
        
        if (!r.ok) {
            throw new Error(`POST ${url} failed: ${r.status} - ${text}`);
        }
        
        // Try to clean the response text
        const cleanText = text.trim();

        try {
            return JSON.parse(cleanText);
        } catch {
            // Some endpoints may return plain text (e.g., SIWE message)
            return cleanText;
        }
    } catch (e) {
        console.error(`API POST ${url} error:`, e);
        throw e;
    }
}
