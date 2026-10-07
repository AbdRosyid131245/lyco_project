/** Bungkus handler async agar error masuk ke error-handler Express. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validasi body/query/params pakai skema Zod. */
export function validate(schema, source = 'body') {
	return (req, res, next) => {
		const result = schema.safeParse(req[source]);
		if (!result.success) {
			const details = result.error.issues.map((i) => ({
				path: i.path.join('.'),
				message: i.message
			}));
			return res.status(400).json({ error: 'Validasi gagal.', details });
		}
		req[source] = result.data;
		return next();
	};
}

/* eslint-disable-next-line no-unused-vars */
export function errorHandler(err, _req, res, _next) {
	if (err?.code === 'LIMIT_FILE_SIZE') {
		return res.status(413).json({ error: 'Ukuran file melebihi batas maksimal.' });
	}
	if (err?.code === 'INVALID_FILE_TYPE') {
		return res.status(400).json({ error: 'Tipe file harus JPG, PNG, atau WebP.' });
	}
	// Body JSON malformed (body-parser) — kembalikan 400, bukan 500.
	if (err?.type === 'entity.parse.failed') {
		return res.status(400).json({ error: 'Format JSON tidak valid.' });
	}
	// Teruskan error client (4xx) lain apa adanya, mis. entity.too.large.
	const status = Number(err?.status ?? err?.statusCode);
	if (Number.isInteger(status) && status >= 400 && status < 500) {
		return res.status(status).json({ error: 'Permintaan tidak valid.' });
	}
	console.error(err);
	return res.status(500).json({ error: 'Kesalahan server. Coba lagi.' });
}
