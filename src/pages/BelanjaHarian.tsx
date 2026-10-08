import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah, formatDate, todayISO, generateUniqueCode, exportToCSV } from '@/lib/utils';
import { StatCard, SectionCard, LoadingSpinner, EmptyState, PageHeader } from '@/components/ui';
import { ShoppingCart, Trash2, Download, Plus, Search, X, Pencil, Loader2, AlertCircle } from 'lucide-react';
import type { Purchase, PurchaseCategory } from '@/types';
import { isDateLockedForKasir } from '@/lib/closing';

const CATEGORIES: PurchaseCategory[] = ['Sembako & Bumbu', 'Sayur & Buah'];
const UNITS = ['pcs', 'kg', 'rtg', 'sak', 'gln', 'dus', 'ikat'];

export default function BelanjaHarian() {
  const { isSpv } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Form state
  const [form, setForm] = useState({
    date: todayISO(),
    item_name: '',
    category: 'Sembako & Bumbu' as PurchaseCategory,
    qty: '',
    unit: 'kg',
    buy_price: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit state
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    item_name: '',
    category: 'Sembako & Bumbu' as PurchaseCategory,
    qty: '',
    unit: 'kg',
    buy_price: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('purchases').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (dateFrom) query = query.gte('date', dateFrom);
    if (dateTo) query = query.lte('date', dateTo);
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching purchases:', error);
    } else {
      setPurchases((data || []) as Purchase[]);
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const totalModal = (Number(form.qty) || 0) * (Number(form.buy_price) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!isSpv && isDateLockedForKasir(form.date)) {
      setFormError(`Tanggal ${formatDate(form.date)} telah di-closing. Data belanja terkunci untuk kasir.`);
      return;
    }

    if (!form.item_name.trim()) {
      setFormError('Nama barang wajib diisi');
      return;
    }
    if (!form.qty || Number(form.qty) <= 0) {
      setFormError('Jumlah harus lebih dari 0');
      return;
    }
    if (!form.buy_price || Number(form.buy_price) < 0) {
      setFormError('Harga beli tidak valid');
      return;
    }

    setSaving(true);
    const code = generateUniqueCode('PCH');
    const { data, error } = await supabase
      .from('purchases')
      .insert({
        code,
        date: form.date,
        item_name: form.item_name.trim(),
        category: form.category,
        qty: Number(form.qty),
        unit: form.unit,
        buy_price: Number(form.buy_price),
        total_modal: totalModal,
      })
      .select()
      .single();

    setSaving(false);
    if (error) {
      setFormError('Gagal menyimpan: ' + error.message);
      return;
    }

    setPurchases((prev) => [data as Purchase, ...prev]);
    setForm({
      date: todayISO(),
      item_name: '',
      category: 'Sembako & Bumbu',
      qty: '',
      unit: 'kg',
      buy_price: '',
    });
  };

  const startEdit = (p: Purchase) => {
    setEditingPurchase(p);
    setEditForm({
      date: p.date,
      item_name: p.item_name,
      category: p.category,
      qty: String(p.qty),
      unit: p.unit,
      buy_price: String(p.buy_price),
    });
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    setEditError('');

    if (!editForm.item_name.trim()) {
      setEditError('Nama barang wajib diisi');
      return;
    }
    if (!editForm.qty || Number(editForm.qty) <= 0) {
      setEditError('Jumlah harus lebih dari 0');
      return;
    }
    if (!editForm.buy_price || Number(editForm.buy_price) < 0) {
      setEditError('Harga beli tidak valid');
      return;
    }

    setEditSaving(true);
    const total_modal = Number(editForm.qty) * Number(editForm.buy_price);
    const { data, error } = await supabase
      .from('purchases')
      .update({
        date: editForm.date,
        item_name: editForm.item_name.trim(),
        category: editForm.category,
        qty: Number(editForm.qty),
        unit: editForm.unit,
        buy_price: Number(editForm.buy_price),
        total_modal,
      })
      .eq('id', editingPurchase.id)
      .select()
      .single();

    setEditSaving(false);
    if (error) {
      setEditError('Gagal menyimpan perubahan: ' + error.message);
      return;
    }

    setPurchases((prev) => prev.map((p) => (p.id === editingPurchase.id ? (data as Purchase) : p)));
    setEditingPurchase(null);
  };

  const handleDelete = async (id: string) => {
    if (!isSpv) {
      alert('Akses ditolak: Hanya SPV atau Super Admin yang berwenang menghapus data belanja.');
      return;
    }
    if (!confirm('Hapus data belanja ini?')) return;
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) {
      alert('Gagal menghapus: ' + error.message);
      return;
    }
    setPurchases((prev) => prev.filter((p) => p.id !== id));
  };

  const filtered = purchases.filter((p) =>
    p.item_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalBelanjaFiltered = filtered.reduce((s, p) => s + Number(p.total_modal), 0);

  const handleExport = () => {
    exportToCSV(
      `belanja-harian-${todayISO()}.csv`,
      ['Kode', 'Tanggal', 'Nama Barang', 'Kategori', 'Qty', 'Satuan', 'Harga Beli', 'Total Modal'],
      filtered.map((p) => [p.code, formatDate(p.date), p.item_name, p.category, p.qty, p.unit, p.buy_price, p.total_modal])
    );
  };

  const isCurrentFormDateLocked = !isSpv && isDateLockedForKasir(form.date);

  return (
    <div className="space-y-5">
      <PageHeader title="Belanja Harian" subtitle="Input dan riwayat pembelian stok barang" />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Belanja (Filter)" value={formatRupiah(totalBelanjaFiltered)} icon={ShoppingCart} gradient="bg-gradient-to-br from-rose-600 to-red-700" />
        <StatCard title="Jumlah Transaksi" value={String(filtered.length)} icon={Plus} gradient="bg-gradient-to-br from-blue-600 to-indigo-700" />
        <StatCard title="Jenis Barang Unik" value={String(new Set(filtered.map((p) => p.item_name)).size)} icon={ShoppingCart} gradient="bg-gradient-to-br from-teal-600 to-cyan-700" />
      </div>

      {/* Form */}
      <SectionCard className="p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-teal-400" />
          Input Belanja Baru
        </h3>
        {formError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Tanggal</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Barang</label>
            <input
              type="text"
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
              required
              placeholder="cth: Bawang Merah"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Kategori</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as PurchaseCategory })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah (Qty)</label>
            <input
              type="number"
              step="any"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              required
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Satuan</label>
            <select
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Harga Beli / Satuan</label>
            <input
              type="number"
              value={form.buy_price}
              onChange={(e) => setForm({ ...form, buy_price: e.target.value })}
              required
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          {isCurrentFormDateLocked && (
            <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Tanggal {formatDate(form.date)} telah di-closing. Input belanja terkunci untuk akun Kasir.
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-slate-800">
            <div className="text-sm">
              <span className="text-slate-400">Total Modal: </span>
              <span className="text-teal-400 font-bold text-base">{formatRupiah(totalModal)}</span>
            </div>
            <button
              type="submit"
              disabled={saving || isCurrentFormDateLocked}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Menyimpan...' : 'Simpan Belanja'}
            </button>
          </div>
        </form>
        <p className="text-xs text-slate-500 mt-3">Kode unik akan dibuat otomatis untuk setiap transaksi belanja.</p>
      </SectionCard>

      {/* History Table */}
      <SectionCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-white font-semibold text-sm">Riwayat Belanja</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari barang..."
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-sm w-40 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            <span className="text-slate-500 text-xs">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="Belum ada data belanja" />
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-medium text-xs">Kode</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Tanggal</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Barang</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Kategori</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Qty</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Harga Beli</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Total Modal</th>
                  {isSpv && <th className="py-2.5 px-3 font-medium text-xs text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3">
                      <span className="text-teal-400 text-xs font-mono">{p.code}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 text-xs whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3 text-white font-medium">{p.item_name}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{p.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">{p.qty} {p.unit}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">{formatRupiah(Number(p.buy_price))}</td>
                    <td className="py-2.5 px-3 text-right text-rose-400 font-semibold whitespace-nowrap">{formatRupiah(Number(p.total_modal))}</td>
                    {isSpv && (
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition"
                            title="Edit Belanja"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Hapus Belanja"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Edit Modal */}
      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-white font-semibold text-base flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-teal-400" />
                  Edit Data Belanja
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kode: <span className="font-mono text-teal-400">{editingPurchase.code}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingPurchase(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Kategori</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value as PurchaseCategory })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nama Barang</label>
                <input
                  type="text"
                  value={editForm.item_name}
                  onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah (Qty)</label>
                  <input
                    type="number"
                    step="any"
                    value={editForm.qty}
                    onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Satuan</label>
                  <select
                    value={editForm.unit}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Harga Beli</label>
                  <input
                    type="number"
                    value={editForm.buy_price}
                    onChange={(e) => setEditForm({ ...editForm, buy_price: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl flex items-center justify-between border border-slate-800">
                <span className="text-xs text-slate-400">Total Modal Baru:</span>
                <span className="text-sm font-bold text-rose-400">
                  {formatRupiah((Number(editForm.qty) || 0) * (Number(editForm.buy_price) || 0))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPurchase(null)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm transition shadow-lg disabled:opacity-60"
                >
                  {editSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Perubahan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
