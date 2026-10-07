# Menjalankan Lyco (frontend + backend)

Proyek ini memiliki **backend utama di `backend/` pada root** (bukan salinan `lyco_project-main/backend/`). Backend Express menyediakan REST API dan menyimpan data di SQLite `backend/data/lyco.db`. Frontend SvelteKit kini membaca katalog, kategori, dan pengaturan dari API, dan panel admin menulis ke API menggunakan JWT. Data lokal hanya menjadi tampilan awal/fallback untuk pengunjung jika server mati; perubahan admin **tidak** disimpan di browser.

## Persiapan

Butuh Node.js 22+ dan npm. Jalankan di dua terminal dari root proyek:

```sh
cd backend
cp .env.example .env       # Windows PowerShell: Copy-Item .env.example .env
# Ubah JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD di .env sebelum digunakan secara publik.
npm install
npm run seed               # opsional; pertama kali server jalan akan mengisi database
npm run dev                # http://localhost:3001
```

```sh
cd frontend/lyco_projek
npm install
npm run dev                # http://localhost:5173
```

Buka `http://localhost:5173/admin`. Login dengan username/password dari `.env` backend (default development: `admin` / `lyco123`). Setelah login, menu, kategori, dan pengaturan dikelola di server; unggahan gambar produk tersedia dari form admin. Akun default **harus diganti** sebelum deploy. Mengubah `ADMIN_PASSWORD` setelah admin sudah dibuat **tidak** otomatis mengganti hash password pada database lama; gunakan database baru atau mekanisme reset yang aman.

Konfigurasi opsional frontend: buat `frontend/lyco_projek/.env` berisi `VITE_API_URL=http://localhost:3001` bila alamat backend berbeda. Gunakan `CORS_ORIGIN` di backend untuk mengizinkan origin frontend yang sebenarnya. Gambar bawaan `/menu/...` tetap disajikan frontend; gambar hasil upload `/uploads/...` disajikan backend.

## Verifikasi

```sh
cd backend && npm test
cd frontend/lyco_projek && npm run check && npm run build
```

Cek API: `http://localhost:3001/api/health`. Endpoint dan contoh request tercantum di `backend/README.md`. Tombol reset produk dan reset kategori adalah aksi berbeda; sebelum reset database manual, cadangkan `backend/data/lyco.db` (serta folder `backend/uploads/` jika memakai unggahan). Token admin hanya disimpan di `sessionStorage` dan akan habis sesuai `JWT_EXPIRES_IN`.
