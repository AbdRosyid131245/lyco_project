# Lyco Backend

REST API untuk Lyco Coffee and Place. Menggantikan `localStorage` di frontend
agar data menu/kategori/settings tersimpan permanen dan bisa dikelola multi-admin.

- Runtime: Node.js 22+ (pakai `node:sqlite` bawaan, tanpa server DB terpisah)
- Framework: Express 4 + Zod + JWT + bcrypt + Multer
- DB default: file SQLite `data/lyco.db` (diabaikan git), termasuk bila `.env`
  tidak ada. Path `.env` dan path relatif DB/upload mengacu pada folder `backend/`.
  Gunakan `DB_PATH=:memory:` hanya jika memang ingin DB sementara.

## Cara jalan

```sh
cd backend
cp .env.example .env   # opsional; di Windows: copy .env.example .env
npm install
npm run dev            # http://localhost:3001; isi awal otomatis pada DB baru
```

Akun awal dari `.env`: `ADMIN_USERNAME` / `ADMIN_PASSWORD` (default development `admin` / `lyco123`).
Untuk `NODE_ENV=production`, ketiga variabel `JWT_SECRET` (minimal 32 karakter),
`ADMIN_USERNAME`, dan `ADMIN_PASSWORD` (bukan default) wajib diatur. Jangan gunakan
contoh kredensial development untuk deployment publik. Mengubah password di `.env`
tidak otomatis mengubah hash admin di database yang sudah ada.
DB baru otomatis mendapat 1 admin, 11 kategori, 68 produk, dan settings.
`npm run seed` hanya mengisi DB yang belum diinisialisasi; menghapus seluruh produk
atau kategori tidak membuatnya muncul kembali saat restart atau menjalankan seed.
`npm run seed:reset` **menghapus semua data** (termasuk admin dan settings) lalu
mengisi ulang dari seed. Simpan cadangan DB sebelum reset.

## Endpoint

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/api/health` | — | cek hidup |
| GET | `/api/stats` | — | total, kategori, unggulan, kosong (dipakai dashboard) |
| GET | `/api/images` | — | daftar URL image unik |
| POST | `/api/auth/login` | — | `{username, password}` → `{token}` |
| GET | `/api/auth/me` | admin | profil dari token |
| GET | `/api/products?category=&search=&featured=true&limit=100&offset=0` | — | list + `total` |
| GET | `/api/products/:id` | — | detail |
| POST | `/api/products` | admin | buat produk |
| PUT | `/api/products/:id` | admin | edit penuh |
| DELETE | `/api/products/:id` | admin | hapus |
| POST | `/api/products/reset` | admin | reset produk saja; kategori tetap, kategori bawaan yang hilang ditambahkan |
| GET | `/api/categories` | — | `{items:[{name, productCount}]}` urut `position` |
| POST | `/api/categories` | admin | `{name}` |
| PUT | `/api/categories/reorder` | admin | `{order:[nama...]}` harus lengkap |
| PUT | `/api/categories/:name` | admin | rename + produk ikut pindah |
| DELETE | `/api/categories/:name` | admin | ditolak 409 kalau masih dipakai |
| POST | `/api/categories/reset` | admin | reset kategori tanpa mengubah produk; kategori kustom yang masih dipakai tetap ada |
| GET | `/api/settings` | — | settings landing page |
| PUT | `/api/settings` | admin | partial update |
| POST | `/api/settings/reset` | admin | kembalikan ke bawaan |
| POST | `/api/uploads` | admin | form `image` (JPG/PNG/WebP ≤ 2MB) → `{url}` |
| DELETE | `/api/uploads/:filename` | admin | hapus file upload |

Auth: header `Authorization: Bearer <token>`. Saat membuat/mengedit produk,
`category` harus nama kategori yang ada (jika tidak, HTTP 409).

Contoh:

```sh
curl -s http://localhost:3001/api/health
curl -s "http://localhost:3001/api/products?category=Coffee&limit=5"
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"lyco123"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).token))")
curl -s http://localhost:3001/api/stats
```

## Testing

```sh
npm test   # node:test + supertest, DB :memory: dan file SQLite sementara
```

## Struktur

```
backend/
  src/index.js      # boot server
  src/app.js        # createApp({dbPath}) — dipakai server + test
  src/config.js     # baca .env
  src/db.js         # skema SQLite + seed + settings
  src/seed-data.js  # GENERATED dari frontend products.ts (68 produk)
  src/seed-settings.js
  src/seed.js       # CLI npm run seed
  src/schemas.js    # validasi Zod (samakan aturan frontend)
  src/middleware/   # JWT + validate + error handler
  src/routes/       # auth, products, categories, settings, uploads
  test/*.test.js   # API, config, persistensi dan reset
  data/             # lyco.db (gitignored)
  uploads/          # hasil upload (gitignored)
```

Regenerate seed: ubah `frontend/.../products.ts` lalu generate ulang
`src/seed-data.js` (lihat riwayat commit untuk skripnya) dan `npm run seed:reset`
di dev saja.
