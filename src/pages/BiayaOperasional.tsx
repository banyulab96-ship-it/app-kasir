import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatRupiah, formatDate, todayISO, exportToCSV, endOfMonth, formatDateInput } from '@/lib/utils';
import { StatCard, SectionCard, LoadingSpinner, EmptyState, PageHeader } from '@/components/ui';
import { Wallet, Trash2, Download, Plus, Search, X, AlertCircle } from 'lucide-react';
import type { Expense, ExpenseCategory } from '@/types';
import { isDateLockedForKasir } from '@/lib/closing';

const CATEGORIES: ExpenseCategory[] = [
  'Gaji Karyawan',
  'Biaya Operasional',
  'Barang Retur',
  'Biaya Sewa',
  'Biaya Perbaikan',
  'BBM',
  'Bagi-bagi / Lain-lain',
];

export default function BiayaOperasional() {
  const { isSpv } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const [form, setForm] = useState({
    date: todayISO(),
    category: 'Gaji Karyawan' as ExpenseCategory,
    amount: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('expenses').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
    if (monthFilter) {
      const [y, m] = monthFilter.split('-');
      const s = `${y}-${m}-01`;
      const e = formatDateInput(endOfMonth(new Date(Number(y), Number(m) - 1)));
      query = query.gte('date', s).lte('date', e);
    }
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching expenses:', error);
    } else {
      setExpenses((data || []) as Expense[]);
    }
    setLoading(false);
  }, [monthFilter]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!isSpv && isDateLockedForKasir(form.date)) {
      setFormError(`Tanggal ${formatDate(form.date)} telah di-closing. Input biaya terkunci untuk kasir.`);
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setFormError('Jumlah biaya harus lebih dari 0');
      return;
    }
    if (!isSpv) {
      setFormError('Akses ditolak: Hanya SPV atau Super Admin yang berwenang mencatat biaya operasional.');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        date: form.date,
        category: form.category,
        amount: Number(form.amount),
        description: form.description.trim(),
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setFormError('Gagal menyimpan: ' + error.message);
      return;
    }
    setExpenses((prev) => [data as Expense, ...prev]);
    setForm({ date: todayISO(), category: 'Gaji Karyawan', amount: '', description: '' });
  };

  const handleDelete = async (id: string) => {
    if (!isSpv) {
      alert('Akses ditolak: Hanya SPV atau Super Admin yang berwenang menghapus data biaya.');
      return;
    }
    if (!confirm('Hapus data biaya ini?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      alert('Gagal menghapus: ' + error.message);
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const filtered = expenses.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalBiaya = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const handleExport = () => {
    exportToCSV(
      `biaya-operasional-${todayISO()}.csv`,
      ['Tanggal', 'Kategori', 'Jumlah', 'Keterangan'],
      filtered.map((e) => [formatDate(e.date), e.category, e.amount, e.description])
    );
  };

  const isCurrentFormDateLocked = !isSpv && isDateLockedForKasir(form.date);

  return (
    <div className="space-y-5">
      <PageHeader title="Biaya Operasional / Usaha" subtitle="Pengeluaran rutin non-barang dan integrasi laba bersih" />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Total Biaya Usaha (Filter)" value={formatRupiah(totalBiaya)} icon={Wallet} gradient="bg-gradient-to-br from-rose-600 to-red-700" />
        <StatCard title="Jumlah Transaksi" value={String(filtered.length)} icon={Plus} gradient="bg-gradient-to-br from-blue-600 to-indigo-700" />
      </div>

      {/* Form */}
      <SectionCard className="p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-teal-400" />
          Input Biaya Baru
        </h3>
        {formError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-400">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Kategori Biaya</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Jumlah (Rp)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
              placeholder="0"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Keterangan</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Opsional"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          {isCurrentFormDateLocked && (
            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Tanggal {formatDate(form.date)} telah di-closing. Input biaya terkunci untuk akun Kasir.
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving || isCurrentFormDateLocked}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Menyimpan...' : 'Simpan Biaya'}
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Table */}
      <SectionCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-white font-semibold text-sm">Riwayat Pengeluaran Biaya</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari..."
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-sm w-36 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
            </div>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            {monthFilter && (
              <button onClick={() => setMonthFilter('')} className="text-slate-400 hover:text-white">
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
          <EmptyState message="Belum ada data biaya operasional" />
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-medium text-xs">Tanggal</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Kategori</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Keterangan</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Jumlah</th>
                  {isSpv && <th className="py-2.5 px-3 font-medium text-xs text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-slate-300 text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{e.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{e.description || '-'}</td>
                    <td className="py-2.5 px-3 text-right text-rose-400 font-semibold whitespace-nowrap">{formatRupiah(Number(e.amount))}</td>
                    {isSpv && (
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-slate-500 hover:text-red-400 transition"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
