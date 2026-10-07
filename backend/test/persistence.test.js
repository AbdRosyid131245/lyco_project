import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/db.js';

async function login(api) {
	const res = await api.post('/api/auth/login').send({ username: 'admin', password: 'lyco123' });
	assert.equal(res.status, 200);
	return { Authorization: `Bearer ${res.body.token}` };
}

it('file database seeds only once and preserves even empty catalog across restarts (and CLI seed)', async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyco-persistence-'));
	const dbPath = path.join(dir, 'data', 'lyco.db');
	let instance;
	try {
		instance = createApp({ dbPath });
		let api = request(instance.app);
		assert.equal((await api.get('/api/stats')).body.total, 68);
		assert.equal((await api.get('/api/stats')).body.kategori, 11);
		const auth = await login(api);
		const added = await api.post('/api/categories').set(auth).send({ name: 'Custom' });
		assert.equal(added.status, 201);
		const product = await api.post('/api/products').set(auth).send({ name: 'New', price: 2000, category: 'Custom' });
		assert.equal(product.status, 201);
		assert.equal((await api.put('/api/settings').set(auth).send({ heroTitle: 'Persistent' })).status, 200);
		instance.db.close();

		instance = createApp({ dbPath });
		api = request(instance.app);
		assert.equal((await api.get(`/api/products/${product.body.id}`)).body.name, 'New');
		assert.equal((await api.get('/api/settings')).body.heroTitle, 'Persistent');
		assert.ok((await api.get('/api/categories')).body.items.some((c) => c.name === 'Custom'));
		// Simulate bulk deletion, including all categories, without discarding admin/settings.
		instance.db.exec('DELETE FROM products; DELETE FROM categories');
		instance.db.close();

		instance = createApp({ dbPath });
		api = request(instance.app);
		assert.deepEqual((await api.get('/api/stats')).body, { total: 0, kategori: 0, unggulan: 0, kosong: 0 });
		assert.equal((await api.get('/api/settings')).body.heroTitle, 'Persistent');
		assert.equal((await api.get('/api/categories')).body.items.length, 0);
		assert.ok((await login(api)).Authorization);
		seedDatabase(instance.db); // npm run seed must also leave initialized databases alone.
		assert.equal((await api.get('/api/stats')).body.total, 0);
		instance.db.close();

		instance = createApp({ dbPath });
		assert.equal((await request(instance.app).get('/api/stats')).body.kategori, 0);
		seedDatabase(instance.db, { reset: true }); // explicit full reset does reseed.
		assert.equal((await request(instance.app).get('/api/stats')).body.total, 68);
		assert.equal((await request(instance.app).get('/api/stats')).body.kategori, 11);
	} finally {
		instance?.db.close();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

it('upgrade of old unmarked database with empty catalog does not silently reseed it', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyco-upgrade-'));
	const dbPath = path.join(dir, 'lyco.db');
	let instance;
	try {
		instance = createApp({ dbPath });
		instance.db.exec('DELETE FROM products; DELETE FROM categories; DELETE FROM metadata');
		instance.db.close();
		instance = createApp({ dbPath });
		assert.equal(instance.db.prepare('SELECT COUNT(*) AS n FROM products').get().n, 0);
		assert.equal(instance.db.prepare('SELECT COUNT(*) AS n FROM categories').get().n, 0);
		assert.equal(instance.db.prepare("SELECT value FROM metadata WHERE key = 'seed_initialized'").get().value, '1');
	} finally {
		instance?.db.close();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

it('independent resets preserve other data, custom used categories, and restore missing seed categories', async () => {
	const { app, db } = createApp({ dbPath: ':memory:' });
	const api = request(app);
	try {
		const auth = await login(api);
		assert.equal((await api.post('/api/categories').set(auth).send({ name: 'Custom' })).status, 201);
		assert.equal((await api.post('/api/categories').set(auth).send({ name: 'Unused' })).status, 201);
		const product = await api.post('/api/products').set(auth).send({ name: 'Custom product', category: 'Custom', price: 1000 });
		assert.equal(product.status, 201);
		assert.equal((await api.put('/api/settings').set(auth).send({ heroTitle: 'Keep me' })).status, 200);

		const categories = await api.post('/api/categories/reset').set(auth);
		assert.equal(categories.status, 200);
		assert.equal((await api.get(`/api/products/${product.body.id}`)).body.category, 'Custom');
		assert.equal((await api.get('/api/stats')).body.total, 69);
		assert.ok(categories.body.items.some((c) => c.name === 'Custom' && c.productCount === 1));
		assert.ok(!categories.body.items.some((c) => c.name === 'Unused'));
		assert.deepEqual(categories.body.items.slice(0, 2).map((c) => c.name), ['Signature', 'Frappe']);
		assert.equal((await api.get('/api/settings')).body.heroTitle, 'Keep me');

		// Rename a seed category (moving its products), then product reset must restore
		// its missing category without wiping the renamed category or other categories.
		assert.equal((await api.put('/api/categories/Coffee').set(auth).send({ name: 'Coffee renamed' })).status, 200);
		const reset = await api.post('/api/products/reset').set(auth);
		assert.equal(reset.status, 200);
		assert.equal(reset.body.total, 68);
		assert.equal((await api.get(`/api/products/${product.body.id}`)).status, 404);
		const catList = (await api.get('/api/categories')).body.items;
		assert.ok(catList.some((c) => c.name === 'Coffee' && c.productCount > 0));
		assert.ok(catList.some((c) => c.name === 'Coffee renamed' && c.productCount === 0));
		assert.ok(catList.some((c) => c.name === 'Custom'));
		assert.equal((await api.get('/api/stats')).body.total, 68);
		assert.equal((await api.get('/api/settings')).body.heroTitle, 'Keep me');

		assert.equal((await api.post('/api/settings/reset').set(auth)).status, 200);
		assert.notEqual((await api.get('/api/settings')).body.heroTitle, 'Keep me');
		assert.equal((await api.get('/api/stats')).body.total, 68);

		db.exec('DELETE FROM products; DELETE FROM categories');
		assert.equal((await api.post('/api/categories/reset').set(auth)).status, 200);
		assert.equal((await api.get('/api/stats')).body.total, 0);
		assert.equal((await api.get('/api/stats')).body.kategori, 11);
		db.exec('DELETE FROM categories');
		assert.equal((await api.post('/api/products/reset').set(auth)).status, 200);
		assert.equal((await api.get('/api/stats')).body.total, 68);
		assert.equal((await api.get('/api/stats')).body.kategori, 11);
	} finally {
		db.close();
	}
});

it('product creation/update rejects missing categories without changing product data', async () => {
	const { app, db } = createApp({ dbPath: ':memory:' });
	const api = request(app);
	try {
		const auth = await login(api);
		const data = { name: 'Test', price: 1000, category: 'Nonexistent' };
		const create = await api.post('/api/products').set(auth).send(data);
		assert.equal(create.status, 409);
		assert.match(create.body.error, /kategori/i);
		const before = (await api.get('/api/products/1')).body;
		const update = await api.put('/api/products/1').set(auth).send(data);
		assert.equal(update.status, 409);
		assert.deepEqual((await api.get('/api/products/1')).body, before);
		assert.equal((await api.get('/api/stats')).body.total, 68);
		assert.equal((await api.post('/api/products').set(auth).send({ ...data, category: 'Coffee' })).status, 201);
	} finally {
		db.close();
	}
});
