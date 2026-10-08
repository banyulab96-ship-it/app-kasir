/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile, UserAccount, UserRole } from '@/types';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  isSpv: boolean;
  isKasir: boolean;
  users: UserAccount[];
  createUser: (user: { email: string; username?: string; fullName: string; password: string; role: UserRole }) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; error?: string }>;
  resetUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const STORAGE_USERS_KEY = 'dapurkasir_accounts';
const STORAGE_SESSION_KEY = 'dapurkasir_session';
const SUPABASE_SERVICE_EMAIL = 'admin_sys_dapur@dapurkasir.internal';
const SUPABASE_SERVICE_PASS = 'DapurKasir#2026!SecuredAdminKey9988';

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr-superadmin',
    username: 'superadmin',
    email: 'superadmin@dapurkasir.com',
    full_name: 'SUPER ADMIN',
    role: 'superadmin',
    password: '01Desember.',
    created_at: new Date('2026-01-01').toISOString(),
  },
];

function loadStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed: UserAccount[] = JSON.parse(raw);
    // Ensure SUPER ADMIN always exists and password is 01Desember.
    const saIndex = parsed.findIndex((u) => u.email === 'superadmin@dapurkasir.com' || u.username === 'superadmin');
    if (saIndex === -1) {
      parsed.unshift(DEFAULT_USERS[0]);
    } else {
      parsed[saIndex].password = '01Desember.';
      parsed[saIndex].role = 'superadmin';
    }
    return parsed;
  } catch {
    return DEFAULT_USERS;
  }
}

function saveStoredUsers(users: UserAccount[]) {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save users store:', e);
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Ensure Supabase backend has an active session for RLS compliance
  const ensureSupabaseSession = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await supabase.auth.signInWithPassword({
          email: SUPABASE_SERVICE_EMAIL,
          password: SUPABASE_SERVICE_PASS,
        });
      }
    } catch {
      // Offline or network error handled gracefully
    }
  }, []);

  useEffect(() => {
    const initialUsers = loadStoredUsers();
    setUsers(initialUsers);

    // Check existing active session
    try {
      const savedSession = localStorage.getItem(STORAGE_SESSION_KEY);
      if (savedSession) {
        const parsed: Profile = JSON.parse(savedSession);
        setProfile(parsed);
        ensureSupabaseSession();
      }
    } catch {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, [ensureSupabaseSession]);

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password;

    if (!cleanId || !cleanPass) {
      return { error: 'Harap isi username/email dan password.' };
    }

    const currentUsers = loadStoredUsers();

    // Find matching user by email or username
    const found = currentUsers.find((u) => {
      const emailMatch = u.email.toLowerCase() === cleanId;
      const usernameMatch = u.username.toLowerCase() === cleanId;
      const adminAlias = (cleanId === 'admin' || cleanId === 'superadmin') && u.role === 'superadmin';
      return emailMatch || usernameMatch || adminAlias;
    });

    if (!found || found.password !== cleanPass) {
      return { error: 'Email/Username atau password salah.' };
    }

    const newProfile: Profile = {
      id: found.id,
      role: found.role,
      full_name: found.full_name,
      email: found.email,
      created_at: found.created_at,
    };

    setProfile(newProfile);
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(newProfile));

    // Connect to Supabase service session in background for DB RLS access
    await ensureSupabaseSession();

    return { error: null };
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_SESSION_KEY);
    setProfile(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors on signout
    }
  };

  const createUser = async (newUserData: {
    email: string;
    username?: string;
    fullName: string;
    password: string;
    role: UserRole;
  }): Promise<{ success: boolean; error?: string }> => {
    if (profile?.role !== 'superadmin') {
      return { success: false, error: 'Akses ditolak: Hanya Super Admin yang dapat mendaftarkan akun.' };
    }

    const cleanEmail = newUserData.email.trim().toLowerCase();
    const cleanUsername = (newUserData.username || cleanEmail.split('@')[0]).trim().toLowerCase();
    const cleanName = newUserData.fullName.trim();
    const pass = newUserData.password;

    if (!cleanEmail || !cleanName || !pass) {
      return { success: false, error: 'Semua field wajib diisi.' };
    }

    if (pass.length < 6) {
      return { success: false, error: 'Password minimal 6 karakter.' };
    }

    const currentUsers = loadStoredUsers();

    if (currentUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'Email sudah terdaftar.' };
    }

    if (currentUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: 'Username sudah terpakai.' };
    }

    const newUser: UserAccount = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: cleanUsername,
      email: cleanEmail,
      full_name: cleanName,
      role: newUserData.role,
      password: pass,
      created_at: new Date().toISOString(),
    };

    const updated = [...currentUsers, newUser];
    saveStoredUsers(updated);
    setUsers(updated);

    return { success: true };
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    if (profile?.role !== 'superadmin') {
      return { success: false, error: 'Akses ditolak: Hanya Super Admin yang dapat menghapus akun.' };
    }

    const currentUsers = loadStoredUsers();
    const target = currentUsers.find((u) => u.id === userId);

    if (!target) {
      return { success: false, error: 'Pengguna tidak ditemukan.' };
    }

    if (target.email === 'superadmin@dapurkasir.com' || target.role === 'superadmin') {
      return { success: false, error: 'Akun Super Admin utama tidak dapat dihapus demi keamanan.' };
    }

    if (target.id === profile.id) {
      return { success: false, error: 'Anda tidak dapat menghapus akun yang sedang aktif.' };
    }

    const updated = currentUsers.filter((u) => u.id !== userId);
    saveStoredUsers(updated);
    setUsers(updated);

    return { success: true };
  };

  const resetUserPassword = async (userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (profile?.role !== 'superadmin') {
      return { success: false, error: 'Akses ditolak: Hanya Super Admin yang dapat mereset password.' };
    }

    if (newPassword.length < 6) {
      return { success: false, error: 'Password baru minimal 6 karakter.' };
    }

    const currentUsers = loadStoredUsers();
    const idx = currentUsers.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return { success: false, error: 'Pengguna tidak ditemukan.' };
    }

    currentUsers[idx].password = newPassword;
    saveStoredUsers(currentUsers);
    setUsers([...currentUsers]);

    return { success: true };
  };

  const isSuperAdmin = profile?.role === 'superadmin';
  const isSpv = profile?.role === 'spv' || profile?.role === 'superadmin';
  const isKasir = profile?.role === 'kasir';

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        signIn,
        signOut,
        isSuperAdmin,
        isSpv,
        isKasir,
        users,
        createUser,
        deleteUser,
        resetUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
