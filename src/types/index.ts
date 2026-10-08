export type UserRole = 'superadmin' | 'spv' | 'kasir';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  created_at: string;
  email?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  password?: string;
  created_at: string;
}

export type PurchaseCategory = 'Sembako & Bumbu' | 'Sayur & Buah';

export interface Purchase {
  id: string;
  code: string;
  date: string;
  item_name: string;
  category: PurchaseCategory;
  qty: number;
  unit: string;
  buy_price: number;
  total_modal: number;
  created_at: string;
}

export interface Sale {
  id: string;
  transaction_code: string;
  date: string;
  item_name: string;
  qty: number;
  unit: string;
  buy_price: number;
  sell_price: number;
  buyer: 'Dapur SK' | 'Dapur WK';
  total_omset: number;
  total_laba: number;
  created_at: string;
}

export type ExpenseCategory =
  | 'Gaji Karyawan'
  | 'Biaya Operasional'
  | 'Barang Retur'
  | 'Biaya Sewa'
  | 'Biaya Perbaikan'
  | 'BBM'
  | 'Bagi-bagi / Lain-lain';

export interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  created_at: string;
}

export interface InventoryItem {
  item_name: string;
  unit: string;
  total_in: number;
  total_out: number;
  sisa_stok: number;
  avg_hpp: number;
  nilai_modal: number;
}

export interface CartItem {
  key: string;
  item_name: string;
  unit: string;
  qty: number;
  buy_price: number;
  sell_price: number;
  sisa_stok: number;
  code?: string;
  date?: string;
  purchase_id?: string;
}
