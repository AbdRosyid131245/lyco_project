import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { ah } from '../middleware/http.js';

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

function hasImageSignature(file, mime) {
	const header = Buffer.alloc(12);
	const fd = fs.openSync(file, 'r');
	try {
		fs.readSync(fd, header, 0, 12, 0);
	} finally {
		fs.closeSync(fd);
	}
	if (mime === 'image/jpeg') return header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
	if (mime === 'image/png') return header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
	return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
}

const storage = multer.diskStorage({
	destination(_req, _file, cb) {
		fs.mkdirSync(config.uploadDir, { recursive: true });
		cb(null, config.uploadDir);
	},
	filename(_req, file, cb) {
		const ext = EXTENSIONS[file.mimetype];
		cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
	}
});

function fileFilter(_req, file, cb) {
	if (!Object.hasOwn(EXTENSIONS, file.mimetype)) {
		const err = new Error('Tipe file harus JPG, PNG, atau WebP.');
		err.code = 'INVALID_FILE_TYPE';
		return cb(err);
	}
	return cb(null, true);
}

export function uploadRoutes() {
	const r = Router();
	const upload = multer({
		storage,
		fileFilter,
		limits: { fileSize: config.maxUploadBytes }
	});

	// Upload satu foto produk (admin). Form field: "image".
	r.post('/', requireAuth, upload.single('image'), (req, res) => {
		if (!req.file) return res.status(400).json({ error: 'File image wajib diisi.' });
		try {
			if (!hasImageSignature(req.file.path, req.file.mimetype)) {
				fs.unlinkSync(req.file.path);
				return res.status(400).json({ error: 'Format file tidak sesuai dengan tipe gambar JPG, PNG, atau WebP.' });
			}
		} catch (error) {
			fs.rmSync(req.file.path, { force: true });
			throw error;
		}
		return res.status(201).json({ url: `/uploads/${req.file.filename}` });
	});

	r.delete(
		'/:filename',
		requireAuth,
		ah(async (req, res) => {
			const name = req.params.filename;
			if (!/^\d+-[a-f0-9]{16}\.(jpg|png|webp)$/.test(name)) {
				return res.status(400).json({ error: 'Nama file tidak valid.' });
			}
			const target = path.join(config.uploadDir, name);
			try {
				await fs.promises.unlink(target);
			} catch (e) {
				if (e?.code === 'ENOENT') return res.status(404).json({ error: 'File tidak ditemukan.' });
				throw e;
			}
			return res.status(204).end();
		})
	);

	return r;
}
