import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah, formatDate, exportToCSV, todayISO } from '@/lib/utils';
import { SectionCard, LoadingSpinner, EmptyState, PageHeader } from '@/components/ui';
import { Search, Download, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { Sale } from '@/types';
import { useAuth } from '@/context/AuthContext';

const UNITS = ['pcs', 'kg', 'rtg', 'sak', 'gln', 'dus', 'ikat'];

interface RiwayatPenjualanProps {
  embedded?: boolean;
  onSalesChanged?: () => void;
  refreshTrigger?: number;
}

export default function RiwayatPenjualan({
  embedded = false,
  onSalesChanged,
  refreshTrigger = 0,
}: RiwayatPenjualanProps) {
  const { isSpv } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState<'all' | 'Dapur SK' | 'Dapur WK'>('all');

  // Edit State
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    buyer: 'Dapur SK' as 'Dapur SK' | 'Dapur WK',
    item_name: '',
    qty: '',
    unit: 'pcs',
    sell_price: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching sales:', error);
    } else {
      setSales((data || []) as Sale[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSales();
  }, [fetchSales, refreshTrigger]);

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (search && !s.item_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (dateFilter && s.date !== dateFilter) return false;
      if (buyerFilter !== 'all' && s.buyer !== buyerFilter) return false;
      return true;
    });
  }, [sales, search, dateFilter, buyerFilter]);

  const totalOmset = filtered.reduce((s, r) => s + Number(r.total_omset), 0);
  const totalLaba = filtered.reduce((s, r) => s + Number(r.total_laba), 0);

  const handleExport = () => {
    exportToCSV(
      `riwayat-penjualan-${todayISO()}.csv`,
      ['Tanggal', 'Pembeli', 'Barang', 'Qty', 'Harga Jual', 'Omset', 'Laba', 'Kode Transaksi'],
      filtered.map((s) => [formatDate(s.date), s.buyer, s.item_name, `${s.qty} ${s.unit}`, s.sell_price, s.total_omset, s.total_laba, s.transaction_code])
    );
  };

  const startEdit = (s: Sale) => {
    setEditingSale(s);
    setEditForm({
      date: s.date,
      buyer: s.buyer,
      item_name: s.item_name,
      qty: String(s.qty),
      unit: s.unit,
      sell_price: String(s.sell_price),
    });
    setEditError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSpv) {
      setEditError('Akses ditolak: Hanya SPV atau Super Admin yang dapat mengubah data.');
      return;
    }
    if (!editingSale) return;
    setEditError('');

    const qty = Number(editForm.qty);
    const sell_price = Number(editForm.sell_price);

    if (!editForm.item_name.trim()) {
      setEditError('Nama barang wajib diisi');
      return;
    }
    if (!qty || qty <= 0) {
      setEditError('Jumlah (qty) harus lebih dari 0');
      return;
    }
    if (sell_price < 0) {
      setEditError('Harga jual tidak valid');
      return;
    }

    setEditSaving(true);
    const total_omset = qty * sell_price;
    const total_laba = qty * (sell_price - Number(editingSale.buy_price));

    const { data, error } = await supabase
      .from('sales')
      .update({
        date: editForm.date,
        buyer: editForm.buyer,
        item_name: editForm.item_name.trim(),
        qty,
        unit: editForm.unit,
        sell_price,
        total_omset,
        total_laba,
      })
      .eq('id', editingSale.id)
      .select()
      .single();

    setEditSaving(false);
    if (error) {
      setEditError('Gagal menyimpan perubahan: ' + error.message);
      return;
    }

    setSales((prev) => prev.map((s) => (s.id === editingSale.id ? (data as Sale) : s)));
    setEditingSale(null);
    onSalesChanged?.();
  };

  const handleDelete = async (id: string) => {
    if (!isSpv) {
      alert('Akses ditolak: Hanya SPV atau Super Admin yang dapat menghapus transaksi.');
      return;
    }
    if (!confirm('Hapus data transaksi penjualan ini?')) return;
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) {
      alert('Gagal menghapus: ' + error.message);
      return;
    }
    setSales((prev) => prev.filter((s) => s.id !== id));
    onSalesChanged?.();
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader title="Riwayat Penjualan" subtitle="Daftar transaksi penjualan dengan filter pencarian" />
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 shadow-lg">
          <p className="text-white/70 text-xs font-medium mb-1">Total Omset (Filter)</p>
          <p className="text-white text-xl font-bold">{formatRupiah(totalOmset)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 shadow-lg">
          <p className="text-white/70 text-xs font-medium mb-1">Total Laba (Filter)</p>
          <p className="text-white text-xl font-bold">{formatRupiah(totalLaba)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 shadow-lg">
          <p className="text-white/70 text-xs font-medium mb-1">Jumlah Transaksi</p>
          <p className="text-white text-xl font-bold">{filtered.length} item</p>
        </div>
      </div>

      {/* Filters */}
      <SectionCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari barang..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter('')} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={buyerFilter}
            onChange={(e) => setBuyerFilter(e.target.value as 'all' | 'Dapur SK' | 'Dapur WK')}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          >
            <option value="all">Semua Unit</option>
            <option value="Dapur SK">Dapur SK</option>
            <option value="Dapur WK">Dapur WK</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-medium transition flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </SectionCard>

      {/* Table */}
      <SectionCard className="p-4">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="Belum ada data penjualan" />
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-medium text-xs">Tanggal</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Pembeli</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Barang</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Qty</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Harga Jual</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Omset</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Laba</th>
                  {isSpv && <th className="py-2.5 px-3 font-medium text-xs text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-slate-300 text-xs whitespace-nowrap">{formatDate(s.date)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.buyer === 'Dapur SK' ? 'bg-teal-500/15 text-teal-300' : 'bg-blue-500/15 text-blue-300'
                      }`}>
                        {s.buyer}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">{s.item_name}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">{s.qty} {s.unit}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">{formatRupiah(Number(s.sell_price))}</td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-semibold whitespace-nowrap">{formatRupiah(Number(s.total_omset))}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold whitespace-nowrap">{formatRupiah(Number(s.total_laba))}</td>
                    {isSpv && (
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => startEdit(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-slate-800 transition"
                            title="Edit Penjualan"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Hapus Penjualan"
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

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-white font-semibold text-base flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-teal-400" />
                  Edit Transaksi Penjualan
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kode: <span className="font-mono text-teal-400">{editingSale.transaction_code}</span>
                </p>
              </div>
              <button
                onClick={() => setEditingSale(null)}
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
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Pembeli</label>
                  <select
                    value={editForm.buyer}
                    onChange={(e) => setEditForm({ ...editForm, buyer: e.target.value as 'Dapur SK' | 'Dapur WK' })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  >
                    <option value="Dapur SK">Dapur SK</option>
                    <option value="Dapur WK">Dapur WK</option>
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
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Harga Jual</label>
                  <input
                    type="number"
                    value={editForm.sell_price}
                    onChange={(e) => setEditForm({ ...editForm, sell_price: e.target.value })}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Estimasi Omset Baru:</span>
                  <span className="text-sm font-bold text-amber-400">
                    {formatRupiah((Number(editForm.qty) || 0) * (Number(editForm.sell_price) || 0))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Estimasi Laba Baru:</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatRupiah(
                      (Number(editForm.qty) || 0) *
                        ((Number(editForm.sell_price) || 0) - Number(editingSale.buy_price))
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
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
