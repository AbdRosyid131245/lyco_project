const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const TOKEN_KEY = 'lyco:admin:token';

export class ApiError extends Error {
	constructor(message: string, public status: number) {
		super(message);
	}
}

export function getToken(): string | null {
	return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
	if (typeof sessionStorage === 'undefined') return;
	if (token) sessionStorage.setItem(TOKEN_KEY, token);
	else sessionStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
	const headers = new Headers(init.headers);
	if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
	if (authenticated) {
		const token = getToken();
		if (!token) throw new ApiError('Silakan masuk kembali sebagai admin.', 401);
		headers.set('Authorization', `Bearer ${token}`);
	}
	let response: Response;
	try {
		response = await fetch(`${BASE}${path}`, { ...init, headers });
	} catch {
		throw new ApiError('Tidak dapat terhubung ke server. Pastikan backend berjalan.', 0);
	}
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new ApiError(body.error ?? `Permintaan gagal (HTTP ${response.status}).`, response.status);
	}
	return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export function imageUrl(src: string): string {
	return src.startsWith('/uploads/') ? `${BASE}${src}` : src;
}
