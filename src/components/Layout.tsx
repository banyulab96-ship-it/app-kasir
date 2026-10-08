import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  ScanLine,
  Package,
  Wallet,
  CalendarCheck,
  UserCog,
  LogOut,
  ChefHat,
  Shield,
  User,
  Sparkles,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'belanja'
  | 'kasir'
  | 'stok'
  | 'biaya'
  | 'closing'
  | 'pengguna';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'belanja', label: 'Belanja Harian', icon: ShoppingCart },
  { id: 'kasir', label: 'Kasir & Penjualan', icon: ScanLine },
  { id: 'stok', label: 'Stok Barang', icon: Package },
  { id: 'biaya', label: 'Biaya Operasional', icon: Wallet },
  { id: 'closing', label: 'Closing Kasir', icon: CalendarCheck },
  { id: 'pengguna', label: 'Kelola Akun', icon: UserCog, superAdminOnly: true },
];

interface LayoutProps {
  children: ReactNode;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { profile, isSuperAdmin, isSpv, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    return true;
  });

  const currentLabel = navItems.find((n) => n.id === currentPage)?.label ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-slate-900 border-r border-slate-800 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 shadow-lg shadow-teal-500/20">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-wide">DapurKasir</p>
            <p className="text-teal-400 text-[11px] font-semibold tracking-wider">PRO SYSTEM</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-teal-300 border border-teal-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.id === 'pengguna' && (
                  <span className="ml-auto text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                    ADMIN
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User profile & logout */}
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800/50 border border-slate-800 mb-2">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-xl ${
                isSuperAdmin
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : isSpv
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {isSuperAdmin ? (
                <Sparkles className="w-4 h-4" />
              ) : isSpv ? (
                <Shield className="w-4 h-4" />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-xs font-semibold truncate">
                {profile?.full_name || 'Pengguna'}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {profile?.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Sistem
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-1 py-1.5 safe-area-bottom">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-0 ${
                active ? 'text-teal-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[9px] font-medium truncate max-w-[55px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Container */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-blue-600">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base lg:text-lg">{currentLabel}</h1>
              <p className="text-slate-500 text-xs hidden sm:block">DapurKasir Pro</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isSuperAdmin
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : isSpv
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                  : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
              }`}
            >
              {isSuperAdmin ? (
                <Sparkles className="w-3 h-3" />
              ) : isSpv ? (
                <Shield className="w-3 h-3" />
              ) : (
                <User className="w-3 h-3" />
              )}
              <span>{profile?.role?.toUpperCase()}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
