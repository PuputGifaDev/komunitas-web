# Internet Club Semarang — React + API terpisah

## Menjalankan API

```bash
npm install
cp .env.example .env
npm run dev
```

API berjalan di `http://localhost:5000`. Database SQLite dibuat otomatis pada startup.

## Menjalankan frontend React

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di `http://localhost:5173`. Jika API memakai URL lain, buat `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Login admin lokal

- Username: `admin`
- Password: `admin123`

Ganti kredensial dan `JWT_SECRET` sebelum deployment production. Admin panel saat ini menyediakan login, tambah/hapus artikel dan event, serta koneksi ke endpoint dokumen. Upload file dapat dihubungkan ke form multipart yang sudah didukung API.
