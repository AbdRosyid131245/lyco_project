import { api } from '../api.js';
import { categoryOrder } from './products.js';
import { loadCatalog } from './productsStore.svelte.js';

export const defaultCategories: string[] = [...categoryOrder];
export const categoriesState = $state<{ items: string[] }>({ items: [...defaultCategories] });

type CategoryResponse = { items: { name: string; productCount: number }[] };
function apply(result: CategoryResponse): void {
	categoriesState.items = result.items.map((category) => category.name);
}

export async function loadCategories(): Promise<void> {
	apply(await api<CategoryResponse>('/api/categories'));
}

export async function addCategory(name: string): Promise<void> {
	apply(await api<CategoryResponse>('/api/categories', {
		method: 'POST', body: JSON.stringify({ name: name.trim() })
	}, true));
}

export async function renameCategory(oldName: string, newName: string): Promise<void> {
	apply(await api<CategoryResponse>(`/api/categories/${encodeURIComponent(oldName)}`, {
		method: 'PUT', body: JSON.stringify({ name: newName.trim() })
	}, true));
	await loadCatalog(); // backend mengganti nama kategori semua produk secara bersamaan
}

export async function deleteCategory(name: string): Promise<void> {
	apply(await api<CategoryResponse>(`/api/categories/${encodeURIComponent(name)}`, {
		method: 'DELETE'
	}, true));
}

export async function moveCategory(name: string, direction: -1 | 1): Promise<void> {
	const idx = categoriesState.items.indexOf(name);
	const target = idx + direction;
	if (idx === -1 || target < 0 || target >= categoriesState.items.length) return;
	const order = [...categoriesState.items];
	const [moved] = order.splice(idx, 1);
	order.splice(target, 0, moved);
	apply(await api<CategoryResponse>('/api/categories/reorder', {
		method: 'PUT', body: JSON.stringify({ order })
	}, true));
}

export async function resetCategories(): Promise<void> {
	apply(await api<CategoryResponse>('/api/categories/reset', { method: 'POST' }, true));
}
