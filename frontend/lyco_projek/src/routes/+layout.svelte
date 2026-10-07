<script lang="ts">
	import '../app.css';
	import { onMount, type Snippet } from 'svelte';
	import { loadCatalog } from '#lib/data/productsStore.svelte.js';
	import { loadCategories } from '#lib/data/categoriesStore.svelte.js';
	import { loadSettings } from '#lib/data/settingsStore.svelte.js';

	onMount(() => {
		// Jika API mati, halaman publik tetap menampilkan katalog bawaan.
		void Promise.allSettled([loadCatalog(), loadCategories(), loadSettings()]);
	});

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
