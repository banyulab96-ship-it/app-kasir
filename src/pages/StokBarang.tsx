import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah, exportToCSV, todayISO } from '@/lib/utils';
import { SectionCard, LoadingSpinner, EmptyState, PageHeader } from '@/components/ui';
import { Search, Download, AlertTriangle, Package, X } from 'lucide-react';
import type { InventoryItem } from '@/types';

type StatusFilter = 'all' | 'available' | 'empty';

interface PurchaseStockRow {
  item_name: string;
  qty: number;
  unit: string;
  buy_price: number;
  date: string;
}

interface SaleStockRow {
  item_name: string;
  qty: number;
}

export default function StokBarang() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    const { data: purchases } = await supabase
      .from('purchases')
      .select('item_name, qty, unit, buy_price, date')
      .order('date', { ascending: true });

    const { data: sales } = await supabase.from('sales').select('item_name, qty');

    const purchasesData = (purchases || []) as unknown as PurchaseStockRow[];
    const salesData = (sales || []) as unknown as SaleStockRow[];

    const map = new Map<string, { in: number; inValue: number; out: number; unit: string }>();
    purchasesData.forEach((p: PurchaseStockRow) => {
      const existing = map.get(p.item_name);
      if (existing) {
        existing.in += Number(p.qty);
        existing.inValue += Number(p.qty) * Number(p.buy_price);
      } else {
        map.set(p.item_name, {
          in: Number(p.qty),
          inValue: Number(p.qty) * Number(p.buy_price),
          out: 0,
          unit: p.unit,
        });
      }
    });
    salesData.forEach((s: SaleStockRow) => {
      const item = map.get(s.item_name);
      if (item) item.out += Number(s.qty);
    });

    const result: InventoryItem[] = [];
    map.forEach((v, k) => {
      const sisa = v.in - v.out;
      const avgHpp = v.in > 0 ? v.inValue / v.in : 0;
      result.push({
        item_name: k,
        unit: v.unit,
        total_in: v.in,
        total_out: v.out,
        sisa_stok: sisa,
        avg_hpp: Math.round(avgHpp),
        nilai_modal: sisa > 0 ? Math.round(sisa * avgHpp) : 0,
      });
    });
    result.sort((a, b) => a.item_name.localeCompare(b.item_name));
    setItems(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      result = result.filter((i) => i.item_name.toLowerCase().includes(search.toLowerCase()));
    }
    if (statusFilter === 'available') {
      result = result.filter((i) => i.sisa_stok > 0);
    } else if (statusFilter === 'empty') {
      result = result.filter((i) => i.sisa_stok <= 0);
    }
    return result;
  }, [items, search, statusFilter]);

  const totalNilaiStok = items.reduce((s, i) => s + i.nilai_modal, 0);
  const habisCount = items.filter((i) => i.sisa_stok <= 0).length;

  const handleExport = () => {
    exportToCSV(
      `stok-barang-${todayISO()}.csv`,
      ['Nama Barang', 'Satuan', 'Total Masuk', 'Total Keluar', 'Sisa Stok', 'HPP Rata-rata', 'Nilai Modal'],
      filtered.map((i) => [i.item_name, i.unit, i.total_in, i.total_out, i.sisa_stok, i.avg_hpp, i.nilai_modal])
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Stok Barang" subtitle="Kartu stok real-time dan nilai inventaris" />

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-5 shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 mb-3">
              <Package className="w-5 h-5 text-white" />
            </div>
            <p className="text-white/70 text-xs font-medium mb-1">Nilai Stok</p>
            <p className="text-white text-2xl font-bold">{formatRupiah(totalNilaiStok)}</p>
            <p className="text-white/50 text-xs mt-1">Estimasi nilai sisa stok</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 p-5 shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
          <div className="relative">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 mb-3">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <p className="text-white/70 text-xs font-medium mb-1">Habis / Minus</p>
            <p className="text-white text-2xl font-bold">{habisCount} jenis</p>
            <p className="text-white/50 text-xs mt-1">Barang stok 0 atau minus</p>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <SectionCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === 'all' ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter('available')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === 'available' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Tersedia
            </button>
            <button
              onClick={() => setStatusFilter('empty')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === 'empty' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Habis / Minus
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama barang..."
                className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-white text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-medium transition flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Table */}
      <SectionCard className="p-4">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="Tidak ada data stok" />
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3 font-medium text-xs">Nama Barang</th>
                  <th className="py-2.5 px-3 font-medium text-xs">Satuan</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Total Masuk</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Total Keluar</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Sisa Stok</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">HPP Rata-rata</th>
                  <th className="py-2.5 px-3 font-medium text-xs text-right">Nilai Modal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isEmpty = item.sisa_stok <= 0;
                  return (
                    <tr
                      key={item.item_name}
                      className={`border-b border-slate-800/50 transition ${
                        isEmpty ? 'bg-red-500/5' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {isEmpty && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                          <span className={`font-medium ${isEmpty ? 'text-red-300' : 'text-white'}`}>{item.item_name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-xs">{item.unit}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-emerald-400 font-medium">{item.total_in}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="text-amber-400 font-medium">{item.total_out}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {item.sisa_stok <= 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                            {item.sisa_stok === 0 ? '0 • HABIS' : `${item.sisa_stok} • MINUS`}
                          </span>
                        ) : (
                          <span className="text-slate-200 font-medium">{item.sisa_stok}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">{formatRupiah(item.avg_hpp)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300 whitespace-nowrap">
                        {item.nilai_modal > 0 ? formatRupiah(item.nilai_modal) : 'Rp 0'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
