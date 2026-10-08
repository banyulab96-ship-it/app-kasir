# DapurKasir Pro - Sistem Manajemen Kasir & Operasional Dapur

Aplikasi POS & Manajemen Operasional Dapur yang aman, cepat, dan modern.

## 🔐 Akun & Hak Akses

Fitur pendaftaran publik pada tampilan login telah dinonaktifkan demi keamanan. Akun baru hanya dapat didaftarkan oleh **Super Admin** dari dalam sistem melalui menu **Kelola Akun**.

| Peran | Username / Email | Password | Akses & Wewenang |
|---|---|---|---|
| **SUPER ADMIN** | `superadmin` / `superadmin@dapurkasir.com` | `01Desember.` | **Akses Penuh + Pendaftaran & Manajemen Akun Pengguna** |
| **Supervisor (SPV)** | `spv` / `spv@dapurkasir.com` | `spv12345` | Belanja Harian, Stok Barang, Biaya Operasional, Approval Closing |
| **Kasir** | `kasir` / `kasir@dapurkasir.com` | `kasir12345` | Transaksi Kasir, Stok (Read-only), Closing Kasir |

---

## 🚀 Menjalankan Aplikasi Secara Lokal

1. Pastikan Node.js sudah terinstal.
2. Jalankan perintah:
```bash
npm run dev
```
3. Buka browser pada:
```
http://127.0.0.1:5173/
```

---

## 🛠️ Fitur-Fitur Utama

1. **Keamanan Berlapis (Frontend & Backend)**:
   - Login terproteksi (tanpa form registrasi publik).
   - Validasi hak akses dinamis berdasarkan peran pengguna (`superadmin`, `spv`, `kasir`).
   - Proteksi edit dan hapus data transaksi hanya untuk SPV dan Super Admin.
   - Proteksi closing harian dan mingguan.
2. **Kelola Akun (Khusus Super Admin)**:
   - Formulir pendaftaran akun kasir & supervisor baru.
   - Fitur generate password acak yang aman.
   - Fitur reset password untuk setiap pengguna.
   - Fitur hapus akun (dengan proteksi akun utama tidak dapat dihapus).
3. **Modul Kasir & Penjualan**:
   - Transaksi cepat dengan keranjang dan pencarian barang.
   - Riwayat penjualan terintegrasi.
4. **Belanja Harian & Stok FIFO**:
   - Pencatatan stok masuk dan harga modal.
   - Perhitungan otomatis sisa stok dan nilai modal.
5. **Biaya Operasional**:
   - Pencatatan pengeluaran operasional (Gaji, Biaya Operasional, Retur, Sewa, BBM, dll).
6. **Closing Kasir**:
   - Approval berjenjang (Kasir & SPV).
