import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { defaultSettings } from './seed-settings.js';
import { seedCategories, seedProducts } from './seed-data.js';

/**
 * Buka (atau buat) database SQLite + siapkan skema.
 * @param {string} [dbPath] default dari config. Pakai ':memory:' untuk testing.
 */
export function openDatabase(dbPath = config.dbPath) {
	if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
	const db = new DatabaseSync(dbPath);
	db.exec('PRAGMA journal_mode = WAL;');
	db.exec('PRAGMA foreign_keys = ON;');
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE TABLE IF NOT EXISTS categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			position INTEGER NOT NULL DEFAULT 0
		);
		CREATE TABLE IF NOT EXISTS products (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			price INTEGER NOT NULL,
			image TEXT NOT NULL DEFAULT '',
			category TEXT NOT NULL,
			featured INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
		CREATE TABLE IF NOT EXISTS settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			data TEXT NOT NULL,
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE TABLE IF NOT EXISTS metadata (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`);
	return db;
}

export function rowToProduct(row) {
	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? '',
		price: row.price,
		image: row.image ?? '',
		category: row.category,
		featured: row.featured === 1
	};
}

function transaction(db, fn) {
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = fn();
		db.exec('COMMIT');
		return result;
	} catch (err) {
		db.exec('ROLLBACK');
		throw err;
	}
}

function insertProducts(db) {
	const insert = db.prepare(
		'INSERT INTO products (name, description, price, image, category, featured) VALUES (?, ?, ?, ?, ?, ?)'
	);
	for (const p of seedProducts) {
		insert.run(p.name, p.description ?? '', p.price, p.image ?? '', p.category, p.featured ? 1 : 0);
	}
}

/** Seed once per database, not whenever a table happens to be empty. --reset is a full wipe. */
export function seedDatabase(db, { reset = false } = {}) {
	return transaction(db, () => {
		if (reset) {
			db.exec('DELETE FROM products; DELETE FROM categories; DELETE FROM settings; DELETE FROM users; DELETE FROM metadata;');
		}
		if (db.prepare("SELECT 1 FROM metadata WHERE key = 'seed_initialized'").get()) return;

		// Older databases had no marker. Their existing data (including deliberately empty
		// product/category tables) must not be replaced on upgrade.
		const existing = ['users', 'categories', 'products', 'settings'].some((table) =>
			db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()
		);
		if (!existing) {
			const hash = bcrypt.hashSync(config.adminPassword, 10);
			db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(config.adminUsername, hash);
			const insertCategory = db.prepare('INSERT INTO categories (name, position) VALUES (?, ?)');
			seedCategories.forEach((name, i) => insertCategory.run(name, i));
			insertProducts(db);
			db.prepare('INSERT INTO settings (id, data) VALUES (1, ?)').run(JSON.stringify(defaultSettings));
		}
		db.prepare("INSERT INTO metadata (key, value) VALUES ('seed_initialized', '1')").run();
	});
}

/** Reset only the catalog. Restore missing seed categories without disturbing custom categories. */
export function resetProducts(db) {
	return transaction(db, () => {
		db.exec('DELETE FROM products');
		const names = new Set(db.prepare('SELECT name FROM categories').all().map((row) => row.name));
		let position = db.prepare('SELECT COALESCE(MAX(position), -1) AS n FROM categories').get().n + 1;
		const insertCategory = db.prepare('INSERT INTO categories (name, position) VALUES (?, ?)');
		for (const category of new Set(seedProducts.map((p) => p.category))) {
			if (!names.has(category)) insertCategory.run(category, position++);
		}
		insertProducts(db);
	});
}

/** Restore seed categories, retaining custom categories still used by unchanged products. */
export function resetCategories(db) {
	return transaction(db, () => {
		const used = new Set(db.prepare('SELECT DISTINCT category FROM products').all().map((row) => row.category));
		const defaults = new Set(seedCategories);
		const existing = db.prepare('SELECT name FROM categories ORDER BY position, id').all().map((row) => row.name);
		const remove = db.prepare('DELETE FROM categories WHERE name = ?');
		for (const name of existing) {
			if (!defaults.has(name) && !used.has(name)) remove.run(name);
		}
		const present = new Set(existing);
		const insert = db.prepare('INSERT INTO categories (name, position) VALUES (?, ?)');
		const update = db.prepare('UPDATE categories SET position = ? WHERE name = ?');
		const order = [...seedCategories, ...existing.filter((name) => !defaults.has(name) && used.has(name))];
		for (const name of used) {
			if (!defaults.has(name) && !order.includes(name)) order.push(name);
		}
		order.forEach((name, position) => {
			if (present.has(name)) update.run(position, name);
			else insert.run(name, position);
		});
	});
}

export function resetSettings(db) {
	db.prepare("INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')")
		.run(JSON.stringify(defaultSettings));
}

export function readSettings(db) {
	const row = db.prepare('SELECT data FROM settings WHERE id = 1').get();
	if (!row) return { ...defaultSettings };
	try {
		return { ...defaultSettings, ...JSON.parse(row.data) };
	} catch {
		return { ...defaultSettings };
	}
}

export function writeSettings(db, next) {
	const merged = { ...defaultSettings, ...next };
	db.prepare("INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')")
		.run(JSON.stringify(merged));
	return merged;
}
