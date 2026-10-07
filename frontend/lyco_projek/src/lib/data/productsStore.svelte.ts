import { api } from '../api.js';
import { products as defaultProducts, type Product } from './products.js';

/** Data bawaan hanya dipakai sebelum respons API tiba; perubahan selalu dikirim ke server. */
export const catalog = $state<{ items: Product[] }>({ items: defaultProducts });

export async function loadCatalog(): Promise<void> {
	const result = await api<{ items: Product[]; total: number }>('/api/products?limit=200');
	catalog.items = result.items; // [] juga sah: jangan tampilkan data bawaan jika DB memang kosong
}

export async function addProduct(data: Omit<Product, 'id'>): Promise<void> {
	const product = await api<Product>('/api/products', { method: 'POST', body: JSON.stringify(data) }, true);
	catalog.items = [...catalog.items, product];
}

export async function updateProduct(id: number, data: Omit<Product, 'id'>): Promise<void> {
	const product = await api<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true);
	catalog.items = catalog.items.map((item) => item.id === id ? product : item);
}

export async function deleteProduct(id: number): Promise<void> {
	await api<void>(`/api/products/${id}`, { method: 'DELETE' }, true);
	catalog.items = catalog.items.filter((item) => item.id !== id);
}

export async function resetCatalog(): Promise<void> {
	await api('/api/products/reset', { method: 'POST' }, true);
	await loadCatalog();
}

/** Jumlah produk dalam satu kategori. Dipakai tabel kategori admin. */
export function countByCategory(name: string): number {
	return catalog.items.filter((p) => p.category === name).length;
}

/** Daftar foto lokal yang bisa dipilih saat tambah/edit produk. */
export const LOCAL_IMAGES = [
	'/menu/menu-nineteen-frappe.jpg',
	'/menu/menu-lotus-frappe.jpg',
	'/menu/menu-vanilla-frappe.jpg',
	'/menu/menu-sharing-mandhi.jpg',
	'/menu/menu-chicken-blackpepper.jpg',
	'/menu/menu-mandhi-rice.jpg',
	'/menu/menu-chicken-sambal.jpg',
	'/menu/menu-chicken-honey.jpg',
	'/menu/menu-mie-grebek.jpg',
	'/menu/menu-mac-cheese.jpg',
	'/cafe/cafe-gate-siang.jpg',
	'/cafe/cafe-gate-industrial-pdf.jpg',
	'/cafe/cafe-outdoor-beton.jpg',
	'/cafe/cafe-night-ramai.jpg'
];
