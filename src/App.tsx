import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Login from '@/pages/Login';
import Layout, { PageId } from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import BelanjaHarian from '@/pages/BelanjaHarian';
import Kasir from '@/pages/Kasir';
import StokBarang from '@/pages/StokBarang';
import BiayaOperasional from '@/pages/BiayaOperasional';
import Closing from '@/pages/Closing';
import KelolaAkun from '@/pages/KelolaAkun';
import { LoadingSpinner } from '@/components/ui';

function AppContent() {
  const { profile, loading, isSuperAdmin } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner message="Memuat aplikasi DapurKasir..." />
      </div>
    );
  }

  if (!profile) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'belanja':
        return <BelanjaHarian />;
      case 'kasir':
        return <Kasir />;
      case 'stok':
        return <StokBarang />;
      case 'biaya':
        return <BiayaOperasional />;
      case 'closing':
        return <Closing />;
      case 'pengguna':
        return isSuperAdmin ? <KelolaAkun /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
