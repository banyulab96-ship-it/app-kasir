import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatRupiah, formatDate, startOfMonth, endOfMonth, formatDateInput } from '@/lib/utils';
import { StatCard, SectionCard, LoadingSpinner, EmptyState } from '@/components/ui';
import { TrendingUp, TrendingDown, Wallet, Package, AlertTriangle, ArrowLeftRight, BarChart3, LineChart, Sparkles } from 'lucide-react';

interface DailyComparison {
  date: string;
  omset: number;
  modal: number;
}

interface StockAlert {
  item_name: string;
  unit: string;
  sisa_stok: number;
}

interface PurchaseItem { date: string; total_modal: number; }
interface SaleItem { date: string; total_omset: number; total_laba: number; }
interface ExpenseItem { date: string; amount: number; }
interface PurchaseDetail { item_name: string; qty: number; unit: string; }
interface SaleDetail { item_name: string; qty: number; }

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [totalBelanja, setTotalBelanja] = useState(0);
  const [totalOmset, setTotalOmset] = useState(0);
  const [totalLabaKotor, setTotalLabaKotor] = useState(0);
  const [totalBiaya, setTotalBiaya] = useState(0);
  const [totalJenisBarang, setTotalJenisBarang] = useState(0);
  const [dailyData, setDailyData] = useState<DailyComparison[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const now = new Date();
    const sMonth = formatDateInput(startOfMonth(now));
    const eMonth = formatDateInput(endOfMonth(now));

    const [purchasesRes, salesRes, expensesRes] = await Promise.all([
      supabase.from('purchases').select('date, total_modal').gte('date', sMonth).lte('date', eMonth),
      supabase.from('sales').select('date, total_omset, total_laba').gte('date', sMonth).lte('date', eMonth),
      supabase.from('expenses').select('date, amount').gte('date', sMonth).lte('date', eMonth),
    ]);

    const purchasesData = (purchasesRes.data || []) as unknown as PurchaseItem[];
    const salesData = (salesRes.data || []) as unknown as SaleItem[];
    const expensesData = (expensesRes.data || []) as unknown as ExpenseItem[];

    const belanja = purchasesData.reduce((s, r) => s + Number(r.total_modal), 0);
    const omset = salesData.reduce((s, r) => s + Number(r.total_omset), 0);
    const labaKotor = salesData.reduce((s, r) => s + Number(r.total_laba), 0);
    const biaya = expensesData.reduce((s, r) => s + Number(r.amount), 0);

    setTotalBelanja(belanja);
    setTotalOmset(omset);
    setTotalLabaKotor(labaKotor);
    setTotalBiaya(biaya);

    // Daily comparison (Purchases + Expenses as Pengeluaran, vs Sales Omset)
    const dailyMap = new Map<string, DailyComparison>();
    purchasesData.forEach((r) => {
      const key = r.date;
      if (!dailyMap.has(key)) dailyMap.set(key, { date: key, omset: 0, modal: 0 });
      dailyMap.get(key)!.modal += Number(r.total_modal);
    });
    expensesData.forEach((r) => {
      const key = r.date;
      if (key) {
        if (!dailyMap.has(key)) dailyMap.set(key, { date: key, omset: 0, modal: 0 });
        dailyMap.get(key)!.modal += Number(r.amount);
      }
    });
    salesData.forEach((r) => {
      const key = r.date;
      if (!dailyMap.has(key)) dailyMap.set(key, { date: key, omset: 0, modal: 0 });
      dailyMap.get(key)!.omset += Number(r.total_omset);
    });
    setDailyData(Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-14));

    // Total jenis barang & stock alerts
    const allPurchases = await supabase.from('purchases').select('item_name, qty, unit, buy_price, date');
    const allSales = await supabase.from('sales').select('item_name, qty');

    const purchasesDetails = (allPurchases.data || []) as unknown as PurchaseDetail[];
    const salesDetails = (allSales.data || []) as unknown as SaleDetail[];

    const inventoryMap = new Map<string, { in: number; out: number; unit: string }>();
    purchasesDetails.forEach((r) => {
      if (!inventoryMap.has(r.item_name)) inventoryMap.set(r.item_name, { in: 0, out: 0, unit: r.unit });
      inventoryMap.get(r.item_name)!.in += Number(r.qty);
    });
    salesDetails.forEach((r) => {
      if (inventoryMap.has(r.item_name)) inventoryMap.get(r.item_name)!.out += Number(r.qty);
    });

    setTotalJenisBarang(inventoryMap.size);

    const alerts: StockAlert[] = [];
    inventoryMap.forEach((v, k) => {
      const sisa = v.in - v.out;
      if (sisa < 5) alerts.push({ item_name: k, unit: v.unit, sisa_stok: sisa });
    });
    setStockAlerts(alerts.sort((a, b) => a.sisa_stok - b.sisa_stok));

    setLoading(false);
  };

  const labaBersih = totalLabaKotor - totalBiaya;

  const maxDaily = useMemo(() => {
    if (dailyData.length === 0) return 1;
    const max = Math.max(...dailyData.map((d) => Math.max(d.omset, d.modal)), 100000);
    // Round up nicely
    return Math.ceil(max / 50000) * 50000;
  }, [dailyData]);

  // Chart coordinates calculation
  const svgWidth = 840;
  const svgHeight = 280;
  const paddingLeft = 70;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 45;
  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  const chartPoints = useMemo(() => {
    const n = dailyData.length;
    if (n === 0) return [];
    return dailyData.map((d, i) => {
      const x = n === 1 ? paddingLeft + plotWidth / 2 : paddingLeft + (i / (n - 1)) * plotWidth;
      const omsetHeight = (d.omset / maxDaily) * plotHeight;
      const modalHeight = (d.modal / maxDaily) * plotHeight;
      const yOmset = paddingTop + plotHeight - omsetHeight;
      const yModal = paddingTop + plotHeight - modalHeight;
      return { x, yOmset, yModal, omsetHeight, modalHeight, d, index: i };
    });
  }, [dailyData, maxDaily, plotWidth, plotHeight, paddingLeft, paddingTop]);

  const areaOmsetPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    const pointsStr = chartPoints.map((p) => `${p.x},${p.yOmset}`).join(' L ');
    const firstX = chartPoints[0].x;
    const lastX = chartPoints[chartPoints.length - 1].x;
    const baseY = paddingTop + plotHeight;
    return `M ${firstX},${baseY} L ${pointsStr} L ${lastX},${baseY} Z`;
  }, [chartPoints, plotHeight, paddingTop]);

  const lineOmsetPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    return 'M ' + chartPoints.map((p) => `${p.x},${p.yOmset}`).join(' L ');
  }, [chartPoints]);

  const areaModalPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    const pointsStr = chartPoints.map((p) => `${p.x},${p.yModal}`).join(' L ');
    const firstX = chartPoints[0].x;
    const lastX = chartPoints[chartPoints.length - 1].x;
    const baseY = paddingTop + plotHeight;
    return `M ${firstX},${baseY} L ${pointsStr} L ${lastX},${baseY} Z`;
  }, [chartPoints, plotHeight, paddingTop]);

  const lineModalPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    return 'M ' + chartPoints.map((p) => `${p.x},${p.yModal}`).join(' L ');
  }, [chartPoints]);

  const hoveredData = hoveredIdx !== null && chartPoints[hoveredIdx] ? chartPoints[hoveredIdx] : null;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Pengeluaran Belanja"
          value={formatRupiah(totalBelanja)}
          icon={TrendingDown}
          gradient="bg-gradient-to-br from-rose-600 to-red-700"
          subtitle="Bulan Ini"
        />
        <StatCard
          title="Total Omset Penjualan"
          value={formatRupiah(totalOmset)}
          icon={TrendingUp}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
          subtitle="Bulan Ini"
        />
        <StatCard
          title="Est. Laba Bersih"
          value={formatRupiah(labaBersih)}
          icon={Wallet}
          gradient={labaBersih >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-600 to-rose-700'}
          subtitle={`Laba Kotor ${formatRupiah(totalLabaKotor)} - Biaya ${formatRupiah(totalBiaya)}`}
        />
        <StatCard
          title="Total Jenis Barang"
          value={String(totalJenisBarang)}
          icon={Package}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
          subtitle="Terdaftar"
        />
      </div>

      {/* Graphical Chart: Omset vs Pengeluaran */}
      <SectionCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-teal-400" />
              <h3 className="text-white font-semibold text-sm">Grafik Perbandingan Omset vs Pengeluaran</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-medium">
                14 Hari Terakhir
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">Visualisasi tren harian omset penjualan vs total pengeluaran</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                chartType === 'bar' ? 'bg-teal-500 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Grafik Batang
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                chartType === 'area' ? 'bg-teal-500 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" /> Grafik Area
            </button>
          </div>
        </div>

        {dailyData.length === 0 ? (
          <EmptyState message="Belum ada data transaksi bulan ini" />
        ) : (
          <div className="relative">
            {/* Tooltip Hover Overlay */}
            {hoveredData && (
              <div className="p-3 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md mb-3 flex items-center justify-between flex-wrap gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-semibold text-white">
                    Tanggal: {formatDate(hoveredData.d.date)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-400">Omset:</span>
                    <span className="text-amber-400 font-bold">{formatRupiah(hoveredData.d.omset)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="text-slate-400">Pengeluaran:</span>
                    <span className="text-rose-400 font-bold">{formatRupiah(hoveredData.d.modal)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 border-l border-slate-700 pl-3">
                    <span className="text-slate-400">Selisih/Laba:</span>
                    <span className={`font-bold ${hoveredData.d.omset >= hoveredData.d.modal ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatRupiah(hoveredData.d.omset - hoveredData.d.modal)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SVG Chart */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[650px] h-64 select-none"
              >
                <defs>
                  {/* Omset Gradient */}
                  <linearGradient id="omsetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="omsetAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
                  </linearGradient>

                  {/* Pengeluaran Gradient */}
                  <linearGradient id="modalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#be123c" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="modalAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#be123c" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines and Y-axis values */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = paddingTop + plotHeight * (1 - ratio);
                  const val = maxDaily * ratio;
                  return (
                    <g key={idx}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={svgWidth - paddingRight}
                        y2={y}
                        stroke="#334155"
                        strokeDasharray={ratio === 0 ? '0' : '4 4'}
                        strokeWidth="1"
                        strokeOpacity="0.4"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 4}
                        fill="#94a3b8"
                        fontSize="10"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {val >= 1000000 ? `${(val / 1000000).toFixed(1)}jt` : `${Math.round(val / 1000)}rb`}
                      </text>
                    </g>
                  );
                })}

                {/* Bar Chart Mode */}
                {chartType === 'bar' && (
                  <>
                    {chartPoints.map((pt, i) => {
                      const n = chartPoints.length;
                      const slotW = plotWidth / n;
                      const barW = Math.max(8, Math.min(22, slotW * 0.36));
                      const isHovered = hoveredIdx === i;
                      const centerX = paddingLeft + (i + 0.5) * slotW;

                      return (
                        <g
                          key={pt.d.date}
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          className="cursor-pointer"
                        >
                          {/* Hover highlight column */}
                          {isHovered && (
                            <rect
                              x={centerX - slotW / 2}
                              y={paddingTop}
                              width={slotW}
                              height={plotHeight}
                              fill="#38bdf8"
                              fillOpacity="0.07"
                              rx="6"
                            />
                          )}

                          {/* Omset Bar */}
                          <rect
                            x={centerX - barW - 1.5}
                            y={pt.yOmset}
                            width={barW}
                            height={Math.max(2, pt.omsetHeight)}
                            fill="url(#omsetGrad)"
                            rx="3"
                            className="transition-all duration-300"
                            stroke={isHovered ? '#fbbf24' : 'none'}
                            strokeWidth="1.5"
                          />

                          {/* Pengeluaran Bar */}
                          <rect
                            x={centerX + 1.5}
                            y={pt.yModal}
                            width={barW}
                            height={Math.max(2, pt.modalHeight)}
                            fill="url(#modalGrad)"
                            rx="3"
                            className="transition-all duration-300"
                            stroke={isHovered ? '#fb7185' : 'none'}
                            strokeWidth="1.5"
                          />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* Area / Line Chart Mode */}
                {chartType === 'area' && (
                  <>
                    {/* Area under Omset */}
                    {areaOmsetPath && <path d={areaOmsetPath} fill="url(#omsetAreaGrad)" />}
                    {/* Area under Pengeluaran */}
                    {areaModalPath && <path d={areaModalPath} fill="url(#modalAreaGrad)" />}

                    {/* Line for Omset */}
                    {lineOmsetPath && (
                      <path
                        d={lineOmsetPath}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Line for Pengeluaran */}
                    {lineModalPath && (
                      <path
                        d={lineModalPath}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Data Points */}
                    {chartPoints.map((pt, i) => {
                      const isHovered = hoveredIdx === i;
                      return (
                        <g
                          key={pt.d.date}
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          className="cursor-pointer"
                        >
                          <circle
                            cx={pt.x}
                            cy={pt.yOmset}
                            r={isHovered ? 6 : 4}
                            fill="#f59e0b"
                            stroke="#0f172a"
                            strokeWidth="2"
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.yModal}
                            r={isHovered ? 6 : 4}
                            fill="#f43f5e"
                            stroke="#0f172a"
                            strokeWidth="2"
                          />
                        </g>
                      );
                    })}
                  </>
                )}

                {/* X-axis date labels */}
                {chartPoints.map((pt, i) => {
                  const n = chartPoints.length;
                  const slotW = plotWidth / n;
                  const posX = chartType === 'bar' ? paddingLeft + (i + 0.5) * slotW : pt.x;
                  const dateParts = pt.d.date.split('-');
                  const label = `${dateParts[2]}/${dateParts[1]}`;
                  const isHovered = hoveredIdx === i;

                  return (
                    <text
                      key={pt.d.date}
                      x={posX}
                      y={svgHeight - 12}
                      fill={isHovered ? '#38bdf8' : '#94a3b8'}
                      fontSize="10"
                      fontWeight={isHovered ? 'bold' : 'normal'}
                      textAnchor="middle"
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Legend & Summary */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-3 border-t border-slate-800 mt-2">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-gradient-to-r from-amber-500 to-orange-500 shadow-sm shadow-amber-500/30" />
                  <span className="text-xs text-slate-300 font-medium">Omset Penjualan</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded bg-gradient-to-r from-rose-500 to-red-500 shadow-sm shadow-rose-500/30" />
                  <span className="text-xs text-slate-300 font-medium">Pengeluaran (Belanja + Biaya)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Arahkan kursor / sentuh grafik untuk melihat rincian angka dan laba harian.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Stock Alerts */}
      <SectionCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-semibold text-sm">Peringatan Stok Kritis</h3>
          <span className="ml-auto text-xs text-slate-500">Stok &lt; 5 atau minus</span>
        </div>
        {stockAlerts.length === 0 ? (
          <EmptyState message="Semua stok aman" />
        ) : (
          <div className="space-y-2">
            {stockAlerts.map((item) => (
              <div
                key={item.item_name}
                className={`flex items-center justify-between rounded-lg px-4 py-2.5 border ${
                  item.sisa_stok <= 0
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${item.sisa_stok <= 0 ? 'text-red-400' : 'text-amber-400'}`} />
                  <span className="text-white text-sm font-medium">{item.item_name}</span>
                </div>
                <span
                  className={`text-sm font-bold ${
                    item.sisa_stok <= 0 ? 'text-red-400' : 'text-amber-400'
                  }`}
                >
                  {item.sisa_stok <= 0 ? `${item.sisa_stok} ${item.unit} • MINUS` : `${item.sisa_stok} ${item.unit}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
