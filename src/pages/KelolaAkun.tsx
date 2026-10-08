import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/utils';
import { SectionCard, PageHeader, StatCard } from '@/components/ui';
import {
  Users,
  UserPlus,
  Shield,
  User,
  Trash2,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { UserRole } from '@/types';

export default function KelolaAkun() {
  const { isSuperAdmin, users, createUser, deleteUser, resetUserPassword } = useAuth();

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('kasir');
  const [showPassword, setShowPassword] = useState(false);

  // Status message
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset password modal
  const [resetModalUser, setResetModalUser] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Akses Ditolak</h2>
        <p className="text-slate-400 text-sm max-w-md">
          Halaman pendaftaran dan manajemen pengguna hanya dapat diakses oleh akun dengan peran <strong>SUPER ADMIN</strong>.
        </p>
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);

    const generatedEmail = email.trim() || `${username.trim().toLowerCase()}@dapurkasir.com`;

    const result = await createUser({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: generatedEmail,
      password,
      role,
    });

    setSubmitting(false);

    if (result.success) {
      setMsg({ type: 'success', text: `Akun "${fullName}" berhasil didaftarkan sebagai ${role.toUpperCase()}!` });
      setFullName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('kasir');
    } else {
      setMsg({ type: 'error', text: result.error || 'Gagal mendaftarkan akun.' });
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!window.confirm(`Yakin ingin menghapus akun "${userName}"? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setMsg(null);
    const result = await deleteUser(userId);
    if (result.success) {
      setMsg({ type: 'success', text: `Akun "${userName}" berhasil dihapus.` });
    } else {
      setMsg({ type: 'error', text: result.error || 'Gagal menghapus akun.' });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    setResetError('');

    if (newPassword.length < 6) {
      setResetError('Password baru minimal 6 karakter.');
      return;
    }

    const result = await resetUserPassword(resetModalUser.id, newPassword);
    if (result.success) {
      setMsg({ type: 'success', text: `Password untuk "${resetModalUser.name}" berhasil diperbarui.` });
      setResetModalUser(null);
      setNewPassword('');
    } else {
      setResetError(result.error || 'Gagal mengubah password.');
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
    setShowPassword(true);
  };

  const totalAdmin = users.filter((u) => u.role === 'superadmin').length;
  const totalSpv = users.filter((u) => u.role === 'spv').length;
  const totalKasir = users.filter((u) => u.role === 'kasir').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kelola & Daftarkan Akun Pengguna"
        subtitle="Hanya Super Admin yang berwenang membuat dan mengelola akun di sistem."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          title="Total Akun Pengguna"
          value={String(users.length)}
          icon={Users}
          gradient="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60"
        />
        <StatCard
          title="Super Admin"
          value={String(totalAdmin)}
          icon={Sparkles}
          gradient="bg-gradient-to-br from-purple-900/60 to-slate-900 border border-purple-700/50"
        />
        <StatCard
          title="Supervisor (SPV)"
          value={String(totalSpv)}
          icon={Shield}
          gradient="bg-gradient-to-br from-teal-900/60 to-slate-900 border border-teal-700/50"
        />
        <StatCard
          title="Kasir"
          value={String(totalKasir)}
          icon={User}
          gradient="bg-gradient-to-br from-blue-900/60 to-slate-900 border border-blue-700/50"
        />
      </div>

      {/* Alert banner */}
      {msg && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 border ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm">{msg.text}</span>
        </div>
      )}

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Pendaftaran Akun */}
        <div className="lg:col-span-5">
          <SectionCard className="p-5 lg:p-6 border-slate-800">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Formulir Akun Baru</h3>
                <p className="text-slate-400 text-xs">Daftarkan staf kasir atau supervisor</p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nama Lengkap <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Misal: Siti Nurhaliza"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="kasir2"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kasir2@dapurkasir.com"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="w-3 h-3" /> Acak Password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Minimal 6 karakter"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Peran & Hak Akses <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('kasir')}
                    className={`p-3 rounded-xl border text-left transition ${
                      role === 'kasir'
                        ? 'border-blue-500 bg-blue-500/15 text-white'
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-semibold">Kasir</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Transaksi kasir & melihat ringkasan
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('spv')}
                    className={`p-3 rounded-xl border text-left transition ${
                      role === 'spv'
                        ? 'border-teal-500 bg-teal-500/15 text-white'
                        : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-teal-400" />
                      <span className="text-sm font-semibold">Supervisor</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Kelola belanja, stok, biaya, & approval closing
                    </p>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold rounded-xl py-2.5 text-sm transition shadow-lg shadow-teal-500/20 disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Mendaftarkan...' : 'Daftarkan Akun'}
              </button>
            </form>
          </SectionCard>
        </div>

        {/* Tabel Daftar Akun */}
        <div className="lg:col-span-7">
          <SectionCard className="p-5 lg:p-6 border-slate-800">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Daftar Akun Terdaftar</h3>
                  <p className="text-slate-400 text-xs">Total {users.length} pengguna aktif</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="py-2.5 px-3">Pengguna</th>
                    <th className="py-2.5 px-3">Peran</th>
                    <th className="py-2.5 px-3">Terdaftar</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => {
                    const isSA = u.role === 'superadmin';
                    const isSPV = u.role === 'spv';
                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                isSA
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : isSPV
                                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate text-xs sm:text-sm">
                                {u.full_name}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {u.username || u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                              isSA
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : isSPV
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {isSA ? 'SUPER ADMIN' : isSPV ? 'SUPERVISOR' : 'KASIR'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-xs">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setResetModalUser({ id: u.id, name: u.full_name });
                                setNewPassword('');
                                setResetError('');
                              }}
                              title="Reset Password"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            {!isSA && (
                              <button
                                type="button"
                                onClick={() => handleDelete(u.id, u.full_name)}
                                title="Hapus Akun"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Modal Reset Password */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Reset Password</h4>
                <p className="text-slate-400 text-xs">{resetModalUser.name}</p>
              </div>
            </div>

            {resetError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                >
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
