import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah, todayISO, generateTransactionCode, formatDate } from '@/lib/utils';
import { SectionCard, LoadingSpinner, EmptyState } from '@/components/ui';
import { Search, Plus, Minus, Trash2, ShoppingCart, Package, AlertTriangle, CheckCircle, X, Receipt, Tag, Calendar } from 'lucide-react';
import type { CartItem, Purchase } from '@/types';
import RiwayatPenjualan from '@/pages/RiwayatPenjualan';
import { useAuth } from '@/context/AuthContext';
import { isDateLockedForKasir } from '@/lib/closing';

export interface PurchaseBatchCard {
  id: string;
  code: string;
  date: string;
  item_name: string;
  category: string;
  qty: number;
  unit: string;
  buy_price: number;
  total_modal: number;
  sisa_stok: number;
}

export default function Kasir() {
  const { isSpv } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<PurchaseBatchCard[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [buyer, setBuyer] = useState<'Dapur SK' | 'Dapur WK'>('Dapur SK');
  const [trxDate, setTrxDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    const [purchasesRes, salesRes] = await Promise.all([
      supabase
        .from('purchases')
        .select('*')
        .order('date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('sales')
        .select('item_name, qty'),
    ]);

    const purchases = (purchasesRes.data || []) as Purchase[];
    const sales = (salesRes.data || []) as { item_name: string; qty: number }[];

    // Calculate total quantity sold for each item_name
    const salesTotalMap = new Map<string, number>();
    sales.forEach((s) => {
      salesTotalMap.set(s.item_name, (salesTotalMap.get(s.item_name) || 0) + Number(s.qty));
    });

    // Group purchases by item_name to calculate FIFO remaining stock for each individual input entry
    const purchasesByItem = new Map<string, Purchase[]>();
    purchases.forEach((p) => {
      if (!purchasesByItem.has(p.item_name)) {
        purchasesByItem.set(p.item_name, []);
      }
      purchasesByItem.get(p.item_name)!.push(p);
    });

    const batchList: PurchaseBatchCard[] = [];

    purchasesByItem.forEach((itemList, itemName) => {
      let remainingSold = salesTotalMap.get(itemName) || 0;
      itemList.forEach((p) => {
        const batchQty = Number(p.qty);
        let batchRemaining = batchQty;
        if (remainingSold > 0) {
          if (remainingSold >= batchQty) {
            batchRemaining = 0;
            remainingSold -= batchQty;
          } else {
            batchRemaining = batchQty - remainingSold;
            remainingSold = 0;
          }
        }
        batchList.push({
          id: p.id,
          code: p.code,
          date: p.date,
          item_name: p.item_name,
          category: p.category,
          qty: batchQty,
          unit: p.unit,
          buy_price: Number(p.buy_price),
          total_modal: Number(p.total_modal),
          sisa_stok: Math.max(0, Math.round(batchRemaining * 100) / 100),
        });
      });
    });

    // Sort: oldest input date first
    batchList.sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
    setBatches(batchList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  // Filter items: only items purchased on or before the transaction date
  const availableItems = useMemo(() => {
    return batches.filter((item) => item.date <= trxDate);
  }, [batches, trxDate]);

  const filteredItems = useMemo(() => {
    if (!search) return availableItems;
    const q = search.toLowerCase();
    return availableItems.filter((item) =>
      item.item_name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [availableItems, search]);

  const addToCart = (item: PurchaseBatchCard) => {
    const existing = cart.find((c) => c.purchase_id === item.id);
    if (existing) {
      updateCartQty(existing.key, 1);
      return;
    }

    const key = `${item.id}-${Date.now()}`;
    setCart((prev) => [
      ...prev,
      {
        key,
        purchase_id: item.id,
        code: item.code,
        date: item.date,
        item_name: item.item_name,
        unit: item.unit,
        qty: 1,
        buy_price: Math.round(item.buy_price),
        sell_price: Math.round(item.buy_price * 1.3),
        sisa_stok: item.sisa_stok,
      },
    ]);
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => (c.key === key ? { ...c, qty: Math.max(0.1, Math.round((c.qty + delta) * 10) / 10) } : c))
    );
  };

  const setCartQty = (key: string, value: string) => {
    const v = Number(value);
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, qty: v > 0 ? v : 0.1 } : c)));
  };

  const setCartSellPrice = (key: string, value: string) => {
    setCart((prev) => prev.map((c) => (c.key === key ? { ...c, sell_price: Number(value) || 0 } : c)));
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  };

  const totals = useMemo(() => {
    const totalOmset = cart.reduce((s, c) => s + c.qty * c.sell_price, 0);
    const totalModal = cart.reduce((s, c) => s + c.qty * c.buy_price, 0);
    const totalLaba = totalOmset - totalModal;
    return { totalOmset, totalModal, totalLaba };
  }, [cart]);

  const isCurrentDateLocked = !isSpv && isDateLockedForKasir(trxDate);

  const handleSave = async () => {
    setSaveMsg(null);
    if (cart.length === 0) {
      setSaveMsg({ type: 'error', text: 'Keranjang masih kosong' });
      return;
    }

    if (isCurrentDateLocked) {
      setSaveMsg({ type: 'error', text: `Tanggal transaksi ${formatDate(trxDate)} telah di-closing. Transaksi terkunci untuk kasir.` });
      return;
    }

    setSaving(true);
    const trxCode = generateTransactionCode();
    const rows = cart.map((c) => ({
      transaction_code: trxCode,
      date: trxDate,
      item_name: c.item_name,
      qty: c.qty,
      unit: c.unit,
      buy_price: c.buy_price,
      sell_price: c.sell_price,
      buyer,
      total_omset: c.qty * c.sell_price,
      total_laba: c.qty * (c.sell_price - c.buy_price),
    }));

    const { error } = await supabase.from('sales').insert(rows);
    setSaving(false);

    if (error) {
      setSaveMsg({ type: 'error', text: 'Gagal menyimpan: ' + error.message });
      return;
    }

    setSaveMsg({ type: 'success', text: `Transaksi ${trxCode} berhasil disimpan!` });
    setCart([]);
    await fetchStock();
    setHistoryRefreshKey((prev) => prev + 1);
    setTimeout(() => setSaveMsg(null), 4000);
  };

  const getStockColor = (sisa: number) => {
    if (sisa <= 0) return 'text-red-400';
    if (sisa < 5) return 'text-amber-400';
    return 'text-emerald-400';
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {saveMsg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${saveMsg.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
        >
          {saveMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {saveMsg.text}
          <button onClick={() => setSaveMsg(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isCurrentDateLocked && (
        <div className="rounded-xl p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Tanggal transaksi <span className="font-semibold">{formatDate(trxDate)}</span> telah di-closing oleh Kasir/SPV. Data terkunci untuk akun Kasir.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Product List (Each input entry is its own card) */}
        <div className="lg:col-span-3 space-y-3">
          <SectionCard className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama barang / kode belanja..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                Total {filteredItems.length} Kartu Inputan
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState message={search ? 'Barang tidak ditemukan' : 'Belum ada stok barang. Input belanja terlebih dahulu.'} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[620px] overflow-y-auto pr-1">
                {filteredItems.map((item) => {
                  const inCart = cart.some((c) => c.purchase_id === item.id);
                  const isHabis = item.sisa_stok <= 0;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${isHabis
                        ? 'bg-red-500/5 border-red-500/20'
                        : 'bg-slate-800/40 border-slate-700/60 hover:border-teal-500/40 hover:bg-slate-800/70 shadow-sm'
                        }`}
                    >
                      <div>
                        {/* Header: Code & Date Badge */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            <Tag className="w-3 h-3 text-teal-400" />
                            {item.code}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {formatDate(item.date)}
                          </span>
                        </div>

                        {/* Title & Category */}
                        <div className="mb-2">
                          <p className="text-white text-sm font-bold leading-tight" title={item.item_name}>
                            {item.item_name}
                          </p>
                          <p className="text-slate-500 text-[10px] mt-0.5">{item.category}</p>
                        </div>

                        {/* Details */}
                        <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/80 space-y-1 mb-3 text-[11px]">
                          {/* <div className="flex items-center justify-between">
                            <span className="text-slate-400">Modal (HPP):</span>
                            <span className="text-slate-200 font-semibold">{formatRupiah(item.buy_price)}/{item.unit}</span>
                          </div> */}
                          <div className="flex items-center justify-between">
                            {/* <span className="text-slate-400">Input Masuk:</span>
                            <span className="text-slate-300">{item.qty} {item.unit}</span> */}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Sisa Stok:</span>
                            <span className={`font-bold ${getStockColor(item.sisa_stok)}`}>
                              {isHabis ? 'Habis (0)' : `${item.sisa_stok} ${item.unit}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => addToCart(item)}
                        disabled={isHabis || isCurrentDateLocked}
                        className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${isHabis
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          : inCart
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30'
                            : 'bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white shadow-md'
                          }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isHabis ? 'Stok Habis' : inCart ? 'Tambah Lagi' : 'Tambah ke Kasir'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-2">
          <SectionCard className="p-4 lg:sticky lg:top-20 flex flex-col max-h-[720px]">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-5 h-5 text-orange-400" />
              <h3 className="text-white font-semibold text-sm">Keranjang Transaksi</h3>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="ml-auto text-xs text-slate-500 hover:text-red-400 transition"
                >
                  Kosongkan
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Pembeli</label>
                <select
                  value={buyer}
                  onChange={(e) => setBuyer(e.target.value as 'Dapur SK' | 'Dapur WK')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                >
                  <option value="Dapur SK">Dapur SK</option>
                  <option value="Dapur WK">Dapur WK</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={trxDate}
                  onChange={(e) => setTrxDate(e.target.value)}
                  max={todayISO()}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>
            </div>

            {trxDate && (
              <p className="text-[11px] text-slate-500 mb-2">
                Menampilkan inputan barang belanja tanggal {formatDate(trxDate)} atau sebelumnya.
              </p>
            )}

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[100px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Package className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-slate-500 text-xs">Keranjang kosong</p>
                </div>
              ) : (
                cart.map((c) => (
                  <div key={c.key} className="rounded-lg bg-slate-800/60 border border-slate-700/50 p-2.5">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-white text-sm font-medium truncate">{c.item_name}</p>
                          {c.code && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-700 text-teal-300">
                              {c.code}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          HPP {formatRupiah(c.buy_price)} • Sisa Batch {c.sisa_stok} {c.unit}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(c.key)}
                        className="text-slate-500 hover:text-red-400 transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Qty controls */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => updateCartQty(c.key, -1)}
                          className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          step="any"
                          value={c.qty}
                          onChange={(e) => setCartQty(c.key, e.target.value)}
                          className="w-12 bg-slate-700 border border-slate-600 rounded text-white text-xs text-center py-0.5 focus:outline-none"
                        />
                        <button
                          onClick={() => updateCartQty(c.key, 1)}
                          className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-slate-500 text-[10px] flex-shrink-0">{c.unit}</span>
                      {/* Sell price */}
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-slate-500 text-[10px]">Jual:</span>
                        <input
                          type="number"
                          value={c.sell_price}
                          onChange={(e) => setCartSellPrice(c.key, e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded text-white text-xs px-1.5 py-0.5 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-700/30">
                      <span className="text-[10px] text-slate-500">Subtotal: <span className="text-amber-400 font-semibold">{formatRupiah(c.qty * c.sell_price)}</span></span>
                      <span className="text-[10px] text-slate-500">Laba: <span className="text-emerald-400 font-semibold">{formatRupiah(c.qty * (c.sell_price - c.buy_price))}</span></span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total Modal</span>
                <span className="text-rose-400 font-semibold">{formatRupiah(totals.totalModal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Total Omset</span>
                <span className="text-amber-400 font-semibold">{formatRupiah(totals.totalOmset)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Estimasi Laba</span>
                <span className="text-emerald-400 font-bold">{formatRupiah(totals.totalLaba)}</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || cart.length === 0 || isCurrentDateLocked}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold rounded-lg py-3 text-sm transition shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {saving ? 'Menyimpan...' : 'Simpan Transaksi'}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Riwayat Penjualan di Bagian Bawah Kasir */}
      <div className="pt-6 border-t border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-400" />
              Riwayat Penjualan
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">Daftar transaksi penjualan kasir & unit pembeli</p>
          </div>
        </div>
        <RiwayatPenjualan
          embedded
          onSalesChanged={fetchStock}
          refreshTrigger={historyRefreshKey}
        />
      </div>
    </div>
  );
}
