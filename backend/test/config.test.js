import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { it } from 'node:test';

const backend = fileURLToPath(new URL('..', import.meta.url));

it('config reads backend .env from any working directory, defaults to persistent DB, and allows explicit memory DB', () => {
	// Keep the real backend .env untouched: run the same config module in a temporary backend-local fixture.
	const dir = fs.mkdtempSync(path.join(backend, 'config-test-'));
	const source = path.join(backend, 'src', 'config.js');
	const fixture = path.join(dir, 'src', 'config.js');
	try {
		fs.mkdirSync(path.dirname(fixture));
		fs.copyFileSync(source, fixture);
		const env = { ...process.env };
		for (const key of ['DB_PATH', 'PORT', 'ADMIN_USERNAME', 'UPLOAD_DIR']) delete env[key];
		const readConfig = (override = {}) => {
			const child = spawnSync(process.execPath, ['--input-type=module', '-e',
				`import { config } from ${JSON.stringify(pathToFileURL(fixture).href)}; console.log(JSON.stringify(config))`
			], { cwd: os.tmpdir(), env: { ...env, ...override }, encoding: 'utf8' });
			assert.equal(child.status, 0, child.stderr);
			return JSON.parse(child.stdout);
		};
		assert.equal(readConfig().dbPath, path.join(dir, 'data', 'lyco.db'));
		fs.writeFileSync(path.join(dir, '.env'), 'PORT=3999\nADMIN_USERNAME=env-admin\nDB_PATH=./data/from-env.db\n');
		const configured = readConfig();
		assert.equal(configured.port, 3999);
		assert.equal(configured.adminUsername, 'env-admin');
		assert.equal(configured.dbPath, path.join(dir, 'data', 'from-env.db'));
		assert.equal(readConfig({ DB_PATH: ':memory:' }).dbPath, ':memory:');
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
