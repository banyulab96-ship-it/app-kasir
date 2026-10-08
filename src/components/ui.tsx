import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ message = 'Memuat data...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-teal-500 animate-spin mb-3" />
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}

export function StatCard({
  title,
  value,
  icon: Icon,
  gradient,
  subtitle,
}: {
  title: string;
  value: string;
  icon: typeof Loader2;
  gradient: string;
  subtitle?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} shadow-lg`}>
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <p className="text-white/70 text-xs font-medium mb-1">{title}</p>
        <p className="text-white text-xl lg:text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="text-white/50 text-xs mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-3">
        <span className="text-2xl">—</span>
      </div>
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900 rounded-2xl border border-slate-800 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h2 className="text-xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
