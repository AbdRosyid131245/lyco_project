import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Root folder backend/ (src/ -> ..). */
export const BACKEND_ROOT = path.resolve(here, '..');
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

// Jangan izinkan kredensial development dipakai tanpa sengaja di deployment.
if (process.env.NODE_ENV === 'production' &&
	(!process.env.JWT_SECRET || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_USERNAME ||
	 process.env.JWT_SECRET.length < 32 || process.env.ADMIN_PASSWORD === 'lyco123')) {
	throw new Error('Production wajib mengatur JWT_SECRET (min. 32 karakter), ADMIN_USERNAME dan ADMIN_PASSWORD non-default.');
}

function resolveMaybe(p) {
	return path.isAbsolute(p) ? p : path.resolve(BACKEND_ROOT, p);
}

export const config = {
	port: Number(process.env.PORT ?? 3001),
	corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean),
	jwtSecret: process.env.JWT_SECRET ?? 'lyco-dev-secret-ganti-di-production-min-32-karakter',
	jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
	adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
	adminPassword: process.env.ADMIN_PASSWORD ?? 'lyco123',
	dbPath: process.env.DB_PATH === ':memory:' ? ':memory:' : resolveMaybe(process.env.DB_PATH || './data/lyco.db'),
	uploadDir: resolveMaybe(process.env.UPLOAD_DIR ?? './uploads'),
	maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 2) * 1024 * 1024
};
