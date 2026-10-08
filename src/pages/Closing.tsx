import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah, formatDate, todayISO, getWeekRange, exportToCSV } from '@/lib/utils';
import { SectionCard, LoadingSpinner, EmptyState, PageHeader, StatCard } from '@/components/ui';
import { CalendarCheck, Download, Calendar, CalendarRange, TrendingUp, TrendingDown, Wallet, ShieldCheck, UserCheck, Lock, Unlock, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getClosingRecord, saveClosingRecord, SPV_CLOSING_CODE, type ClosingRecord } from '@/lib/closing';

type ClosingType = 'daily' | 'weekly';

interface ClosingData {
  omset: number;
  modal: number;
  labaKotor: number;
  biaya: number;
  labaBersih: number;
  jumlahTrx: number;
  details: { date: string; omset: number; modal: number; biaya: number }[];
}

interface SaleRow {
  date: string;
  total_omset: number;
  total_laba: number;
}

interface PurchaseRow {
  date: string;
  total_modal: number;
}

interface ExpenseRow {
  date: string;
  amount: number;
}

export default function Closing() {
  const { profile, isSpv } = useAuth();
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ClosingType>('daily');
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [data, setData] = useState<ClosingData | null>(null);

  // Closing Approval State
  const [closingRecord, setClosingRecord] = useState<ClosingRecord>(getClosingRecord(todayISO()));
  const [spvCode, setSpvCode] = useState('');
  const [spvError, setSpvError] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchClosing = useCallback(async () => {
    setLoading(true);
    let startDate: string;
    let endDate: string;

    if (type === 'daily') {
      startDate = selectedDate;
      endDate = selectedDate;
    } else {
      const range = getWeekRange(new Date(selectedDate));
      startDate = range.start;
      endDate = range.end;
    }

    const [salesRes, purchasesRes, expensesRes] = await Promise.all([
      supabase.from('sales').select('date, total_omset, total_laba').gte('date', startDate).lte('date', endDate),
      supabase.from('purchases').select('date, total_modal').gte('date', startDate).lte('date', endDate),
      supabase.from('expenses').select('date, amount').gte('date', startDate).lte('date', endDate),
    ]);

    const sales = (salesRes.data || []) as unknown as SaleRow[];
    const purchases = (purchasesRes.data || []) as unknown as PurchaseRow[];
    const expenses = (expensesRes.data || []) as unknown as ExpenseRow[];

    const omset = sales.reduce((s: number, r: SaleRow) => s + Number(r.total_omset), 0);
    const labaKotor = sales.reduce((s: number, r: SaleRow) => s + Number(r.total_laba), 0);
    const modal = purchases.reduce((s: number, r: PurchaseRow) => s + Number(r.total_modal), 0);
    const biaya = expenses.reduce((s: number, r: ExpenseRow) => s + Number(r.amount), 0);

    // Daily breakdown
    const dailyMap = new Map<string, { omset: number; modal: number; biaya: number }>();
    sales.forEach((s: SaleRow) => {
      const d = s.date;
      if (!dailyMap.has(d)) dailyMap.set(d, { omset: 0, modal: 0, biaya: 0 });
      dailyMap.get(d)!.omset += Number(s.total_omset);
    });
    purchases.forEach((p: PurchaseRow) => {
      const d = p.date;
      if (!dailyMap.has(d)) dailyMap.set(d, { omset: 0, modal: 0, biaya: 0 });
      dailyMap.get(d)!.modal += Number(p.total_modal);
    });
    expenses.forEach((e: ExpenseRow) => {
      const d = e.date;
      if (!dailyMap.has(d)) dailyMap.set(d, { omset: 0, modal: 0, biaya: 0 });
      dailyMap.get(d)!.biaya += Number(e.amount);
    });

    const details = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    setData({
      omset,
      modal,
      labaKotor,
      biaya,
      labaBersih: labaKotor - biaya,
      jumlahTrx: sales.length,
      details,
    });
    setLoading(false);
  }, [type, selectedDate]);

  useEffect(() => {
    fetchClosing();
    setClosingRecord(getClosingRecord(selectedDate));
    setSpvCode('');
    setSpvError('');
    setActionMsg(null);
  }, [fetchClosing, selectedDate]);

  const periodLabel = type === 'daily' ? formatDate(selectedDate) : (() => {
    const r = getWeekRange(new Date(selectedDate));
    return `${formatDate(r.start)} - ${formatDate(r.end)}`;
  })();

  const handleExport = () => {
    if (!data) return;
    exportToCSV(
      `closing-${type}-${selectedDate}.csv`,
      ['Tanggal', 'Omset', 'Modal', 'Biaya', 'Laba Bersih'],
      data.details.map((d) => [formatDate(d.date), d.omset, d.modal, d.biaya, d.omset - d.modal - d.biaya])
    );
  };

  // Approval Handlers
  const handleKasirApprove = () => {
    if (!confirm(`Konfirmasi setujui closing untuk tanggal ${formatDate(selectedDate)}? Setelah disetujui, kasir tidak dapat menambah atau mengubah transaksi lagi.`)) {
      return;
    }

    const updated: ClosingRecord = {
      ...closingRecord,
      date: selectedDate,
      kasirApproved: true,
      kasirApprovedBy: profile?.full_name || 'Kasir',
      kasirApprovedAt: new Date().toISOString(),
      isClosed: closingRecord.spvApproved,
    };

    saveClosingRecord(updated);
    setClosingRecord(updated);
    setActionMsg({
      type: 'success',
      text: `Approval Kasir berhasil untuk tanggal ${formatDate(selectedDate)}. Data transaksi kini terkunci untuk akun Kasir.`,
    });
  };

  const handleSpvApprove = (e: React.FormEvent) => {
    e.preventDefault();
    setSpvError('');

    if (spvCode.trim() !== SPV_CLOSING_CODE) {
      setSpvError('Kode approval SPV salah! Masukkan kode 123456789.');
      return;
    }

    const updated: ClosingRecord = {
      ...closingRecord,
      date: selectedDate,
      spvApproved: true,
      spvApprovedBy: profile?.full_name || 'Supervisor',
      spvApprovedAt: new Date().toISOString(),
      isClosed: true,
    };

    saveClosingRecord(updated);
    setClosingRecord(updated);
    setSpvCode('');
    setActionMsg({
      type: 'success',
      text: `Approval Supervisor berhasil dengan kode verifikasi! Closing tanggal ${formatDate(selectedDate)} telah FINAL dan terkunci.`,
    });
  };

  const handleResetClosing = () => {
    const inputCode = prompt('Masukkan kode otorisasi SPV untuk membuka kunci closing (123456789):');
    if (inputCode === SPV_CLOSING_CODE) {
      const resetRecord: ClosingRecord = {
        date: selectedDate,
        kasirApproved: false,
        spvApproved: false,
        isClosed: false,
      };
      saveClosingRecord(resetRecord);
      setClosingRecord(resetRecord);
      setActionMsg({
        type: 'success',
        text: `Kunci closing tanggal ${formatDate(selectedDate)} berhasil dibuka kembali oleh Supervisor.`,
      });
    } else if (inputCode !== null) {
      alert('Kode otorisasi SPV salah!');
    }
  };

  const isLockedForKasir = closingRecord.kasirApproved || closingRecord.isClosed;

  return (
    <div className="space-y-5">
      <PageHeader title="Closing" subtitle="Ringkasan hasil penjualan dan persetujuan closing kasir & supervisor" />

      {/* Controls */}
      <SectionCard className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setType('daily')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                type === 'daily' ? 'bg-teal-500 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" /> Harian
            </button>
            <button
              onClick={() => setType('weekly')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
                type === 'weekly' ? 'bg-teal-500 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <CalendarRange className="w-4 h-4" /> Mingguan
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={todayISO()}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-medium transition flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-3">
          Periode: <span className="text-white font-medium">{periodLabel}</span>
        </p>
      </SectionCard>

      {/* Notification banner */}
      {actionMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-sm ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
            <span>{actionMsg.text}</span>
          </div>
          <button onClick={() => setActionMsg(null)} className="text-slate-400 hover:text-white text-xs">
            Tutup
          </button>
        </div>
      )}

      {/* Approval & Data Lock Section (Harian) */}
      {type === 'daily' && (
        <SectionCard className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-teal-400" />
              <h3 className="text-white font-semibold text-sm">Status Approval & Kunci Data Closing</h3>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  isLockedForKasir
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isLockedForKasir ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    Data Terkunci untuk Kasir
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    Data Masih Dapat Diedit
                  </>
                )}
              </span>
              {isSpv && isLockedForKasir && (
                <button
                  onClick={handleResetClosing}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Buka kunci closing dengan kode SPV"
                >
                  Buka Kunci (SPV)
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Panel Approval Kasir */}
            <div className={`p-4 rounded-xl border transition-all ${
              closingRecord.kasirApproved
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-slate-800/40 border-slate-700/60'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${closingRecord.kasirApproved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white text-sm font-semibold">Approval Kasir</h4>
                    <p className="text-[11px] text-slate-400">Persetujuan penutupan transaksi harian</p>
                  </div>
                </div>
                {closingRecord.kasirApproved ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                    Disetujui
                  </span>
                ) : (
                  <span className="text-xs text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                    Belum Disetujui
                  </span>
                )}
              </div>

              {closingRecord.kasirApproved ? (
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Disetujui oleh: <strong className="text-white">{closingRecord.kasirApprovedBy || 'Kasir'}</strong></span>
                  </div>
                  {closingRecord.kasirApprovedAt && (
                    <p className="text-[10px] text-slate-400 pl-5">
                      Waktu: {new Date(closingRecord.kasirApprovedAt).toLocaleString('id-ID')}
                    </p>
                  )}
                  <p className="text-[11px] text-amber-300/80 pt-1">
                    🔒 Kasir tidak dapat lagi mengubah data transaksi tanggal {formatDate(selectedDate)}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-400">
                    Kasir meninjau seluruh transaksi hari ini sebelum menyetujui. Setelah disetujui, kasir tidak dapat mengubah data lagi.
                  </p>
                  <button
                    onClick={handleKasirApprove}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold rounded-lg py-2.5 text-xs transition shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Setujui Closing (Kasir)
                  </button>
                </div>
              )}
            </div>

            {/* 2. Panel Approval Supervisor (SPV) dengan Kode 123456789 */}
            <div className={`p-4 rounded-xl border transition-all ${
              closingRecord.spvApproved
                ? 'bg-blue-500/10 border-blue-500/30'
                : 'bg-slate-800/40 border-slate-700/60'
            }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${closingRecord.spvApproved ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white text-sm font-semibold">Approval Supervisor (SPV)</h4>
                    <p className="text-[11px] text-slate-400">Verifikasi dengan kode keamanan SPV</p>
                  </div>
                </div>
                {closingRecord.spvApproved ? (
                  <span className="text-xs font-bold text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded-full">
                    Terverifikasi
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                    Perlu Kode SPV
                  </span>
                )}
              </div>

              {closingRecord.spvApproved ? (
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Diverifikasi oleh: <strong className="text-white">{closingRecord.spvApprovedBy || 'Supervisor'}</strong></span>
                  </div>
                  {closingRecord.spvApprovedAt && (
                    <p className="text-[10px] text-slate-400 pl-5">
                      Waktu: {new Date(closingRecord.spvApprovedAt).toLocaleString('id-ID')}
                    </p>
                  )}
                  <p className="text-[11px] text-teal-300 pt-1">
                    ✅ Verifikasi kode SPV (123456789) berhasil. Laporan closing telah final.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSpvApprove} className="space-y-2">
                  <p className="text-xs text-slate-400">
                    Masukkan kode otorisasi SPV (<code className="text-teal-300 font-mono">123456789</code>) untuk menyetujui:
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={spvCode}
                        onChange={(e) => setSpvCode(e.target.value)}
                        placeholder="Masukkan kode SPV..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-lg px-4 py-2 text-xs transition shadow-md whitespace-nowrap"
                    >
                      Verifikasi & Setujui
                    </button>
                  </div>
                  {spvError && (
                    <p className="text-xs text-rose-400 flex items-center gap-1 pt-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {spvError}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : !data || (data.jumlahTrx === 0 && data.modal === 0 && data.biaya === 0) ? (
        <SectionCard className="p-5">
          <EmptyState message="Tidak ada data transaksi pada periode ini" />
        </SectionCard>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Omset" value={formatRupiah(data.omset)} icon={TrendingUp} gradient="bg-gradient-to-br from-amber-500 to-orange-600" />
            <StatCard title="Total Modal Belanja" value={formatRupiah(data.modal)} icon={TrendingDown} gradient="bg-gradient-to-br from-rose-600 to-red-700" />
            <StatCard title="Total Biaya Usaha" value={formatRupiah(data.biaya)} icon={Wallet} gradient="bg-gradient-to-br from-slate-600 to-slate-700" />
            <StatCard
              title="Laba Bersih"
              value={formatRupiah(data.labaBersih)}
              icon={CalendarCheck}
              gradient={data.labaBersih >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-600 to-rose-700'}
              subtitle={`Laba Kotor: ${formatRupiah(data.labaKotor)}`}
            />
          </div>

          {/* Breakdown */}
          {data.details.length > 0 && (
            <SectionCard className="p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Rincian Per Hari</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-800">
                      <th className="py-2.5 px-3 font-medium text-xs">Tanggal</th>
                      <th className="py-2.5 px-3 font-medium text-xs text-right">Omset</th>
                      <th className="py-2.5 px-3 font-medium text-xs text-right">Modal</th>
                      <th className="py-2.5 px-3 font-medium text-xs text-right">Biaya</th>
                      <th className="py-2.5 px-3 font-medium text-xs text-right">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.details.map((d) => {
                      const labaBersih = d.omset - d.modal - d.biaya;
                      return (
                        <tr key={d.date} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-3 text-slate-300 text-xs whitespace-nowrap">{formatDate(d.date)}</td>
                          <td className="py-2.5 px-3 text-right text-amber-400 font-medium whitespace-nowrap">{formatRupiah(d.omset)}</td>
                          <td className="py-2.5 px-3 text-right text-rose-400 font-medium whitespace-nowrap">{formatRupiah(d.modal)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400 font-medium whitespace-nowrap">{formatRupiah(d.biaya)}</td>
                          <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${labaBersih >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatRupiah(labaBersih)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700">
                      <td className="py-3 px-3 text-white font-semibold text-xs">Total</td>
                      <td className="py-3 px-3 text-right text-amber-400 font-bold whitespace-nowrap">{formatRupiah(data.omset)}</td>
                      <td className="py-3 px-3 text-right text-rose-400 font-bold whitespace-nowrap">{formatRupiah(data.modal)}</td>
                      <td className="py-3 px-3 text-right text-slate-400 font-bold whitespace-nowrap">{formatRupiah(data.biaya)}</td>
                      <td className={`py-3 px-3 text-right font-bold whitespace-nowrap ${data.labaBersih >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatRupiah(data.labaBersih)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
