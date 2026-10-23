import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { FactoryData } from '@/lib/erp-data';
import { emptyData } from '@/lib/erp-data';
import type { User } from '@supabase/supabase-js';
import type { Json } from '@/integrations/supabase/types';
import { runFactoryAction } from '@/lib/push.functions';

export type AppRole = 'admin' | 'manager' | 'supervisor' | 'accountant' | 'dispatch_clerk' | 'viewer' | 'user' | 'pending';

export const ALL_PAGE_KEYS = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'orders', label: 'Order Entry', path: '/orders' },
  { key: 'production', label: 'Pending Production', path: '/production' },
  { key: 'dispatch', label: 'Dispatch & Delivery Challan', path: '/dispatch' },
  { key: 'parties', label: 'Party Master', path: '/parties' },
  { key: 'catalog', label: 'Item Master', path: '/items' },
  { key: 'workers', label: 'Labour Management', path: '/labour' },
  { key: 'expenses', label: 'Expenses & Borrowings', path: '/expenses' },
  { key: 'reports', label: 'Reports & Realised Profit', path: '/reports' },
  { key: 'settings', label: 'Settings', path: '/settings' },
  { key: 'profile', label: 'Account Profile', path: '/profile' },
] as const;

export const DEFAULT_ROLE_PAGES: Record<AppRole, string[]> = {
  admin: ['dashboard', 'orders', 'production', 'dispatch', 'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile', 'admin'],
  user: ['dashboard', 'orders', 'production', 'dispatch', 'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile'],
  manager: ['dashboard', 'orders', 'production', 'dispatch', 'parties', 'catalog', 'workers', 'expenses', 'reports', 'settings', 'profile'],
  supervisor: ['dashboard', 'production', 'workers', 'parties', 'profile'],
  accountant: ['dashboard', 'dispatch', 'expenses', 'reports', 'profile'],
  dispatch_clerk: ['dashboard', 'dispatch', 'orders', 'catalog', 'profile'],
  viewer: ['dashboard', 'orders', 'production', 'profile'],
  pending: [],
};

export function roleHasCapability(role: AppRole | null | undefined, cap: string): boolean {
  if (role === 'admin') return true;
  if (!role || role === 'pending') return false;
  // Admin-only capabilities
  if (cap === 'manage_users' || cap === 'view_audit') {
    return false;
  }
  // Standard workspace user has full software operational capabilities
  if (role === 'user') return true;
  switch (cap) {
    case 'view_money':
      return role === 'manager' || role === 'accountant';
    case 'create_order':
    case 'edit_order':
      return role === 'manager';
    case 'assign_labour':
      return role === 'manager' || role === 'supervisor';
    case 'set_rates':
      return role === 'manager';
    case 'create_challan':
      return role === 'manager' || role === 'dispatch_clerk';
    case 'confirm_dispatch':
      return role === 'manager' || role === 'dispatch_clerk';
    case 'cancel_challan':
      return role === 'manager';
    case 'close_order_short':
      return false;
    case 'run_payroll':
      return role === 'manager' || role === 'accountant';
    case 'record_payment':
      return role === 'accountant';
    case 'manage_expenses':
    case 'manage_borrowings':
      return role === 'manager' || role === 'accountant';
    case 'manage_masters':
      return role === 'manager';
    case 'manage_users':
    case 'view_audit':
      return false;
    default:
      return false;
  }
}

function getLocalRoles(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('crate_user_roles');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalRole(userId: string, role: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalRoles();
    current[userId] = role;
    localStorage.setItem('crate_user_roles', JSON.stringify(current));
  } catch {}
}

function deleteLocalRole(userId: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalRoles();
    delete current[userId];
    localStorage.setItem('crate_user_roles', JSON.stringify(current));
  } catch {}
}

// Queries read directly from base factory tables (eliminating non-existent v_* views)
const tables = {
  parties: 'party_master',
  catalog: 'item_master',
  orders: 'orders',
  items: 'order_items',
  workers: 'labour_master',
  allocations: 'production_allocations',
  challans: 'delivery_challans',
  challanItems: 'challan_items',
  expenses: 'expenses',
  borrowings: 'labour_borrowings',
  payroll: 'labour_payroll',
  notifications: 'factory_notifications',
  profiles: 'profiles'
} as const;

async function readFactory(): Promise<FactoryData> {
  const result = { ...emptyData };
  await Promise.all(
    Object.entries(tables).map(async ([key, table]) => {
      const { data, error } = await (supabase.from as any)(table).select('*');
      if (error) {
        Object.assign(result, { [key]: [] });
        return;
      }
      Object.assign(result, { [key]: data ?? [] });
    })
  );

  // Keep orders sorted newest first by default across the ERP
  if (Array.isArray(result.orders)) {
    result.orders.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : (a.order_date ? new Date(a.order_date).getTime() : 0);
      const timeB = b.created_at ? new Date(b.created_at).getTime() : (b.order_date ? new Date(b.order_date).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      return (b.order_no || '').localeCompare(a.order_no || '', undefined, { numeric: true });
    });
  }

  // Merge any locally acknowledged roles
  const localRoles = getLocalRoles();
  for (const [uid, role] of Object.entries(localRoles)) {
    if (!result.roles.some(r => r.user_id === uid)) {
      result.roles.push({ id: `local-${uid}`, user_id: uid, role });
    }
  }

  return result;
}

interface Context {
  user: User | null;
  authInitialized: boolean;
  profile: FactoryData['profiles'][number] | null;
  data: FactoryData;
  loading: boolean;
  error: string | null;
  signIn: () => void;
  refresh: () => Promise<void>;
  action: (name: string, payload: Json) => Promise<boolean>;
  userRole: AppRole | null;
  isAdmin: boolean;
  isPendingVerification: boolean;
  isRoleLoading: boolean;
  userAllowedPages: string[];
  hasPageAccess: (pageKey: string) => boolean;
  hasCapability: (capability: string) => boolean;
  handoverRole: (targetUserId: string, role: AppRole, allowedPages?: string[]) => Promise<boolean>;
  updateUserPageAccess: (targetUserId: string, allowedPages: string[]) => Promise<boolean>;
  revokeRole: (targetUserId: string) => Promise<boolean>;
}

const FactoryContext = createContext<Context | undefined>(undefined);

export function useFactory() {
  const c = useContext(FactoryContext);
  if (!c) throw new Error('Factory provider missing');
  return c;
}

export function FactoryProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [serverRole, setServerRole] = useState<AppRole | null>(null);
  const [serverAllowedPages, setServerAllowedPages] = useState<string[] | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const cache = useQueryClient();

  const loadRole = async (uid: string) => {
    try {
      const { fetchUserRoleStatus } = await import('@/lib/auth.functions');
      const res = await fetchUserRoleStatus({ data: { userId: uid } });
      if (res.success && res.role) {
        setServerRole(res.role as AppRole);
        setServerAllowedPages(res.allowedPages);
        setLocalRole(uid, res.role);
      }
    } catch {} finally {
      setRoleLoaded(true);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadRole(user.id);
    } else {
      setServerRole(null);
      setServerAllowedPages(null);
      setRoleLoaded(false);
    }
  }, [user?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthInitialized(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
        setUser(session?.user ?? null);
        setAuthInitialized(true);
        if (event === 'SIGNED_OUT') cache.removeQueries({ queryKey: ['factory'] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [cache]);

  // Determine current user's role status
  let userRole: AppRole | null = null;
  let isAdmin = false;
  let isPendingVerification = false;

  if (user) {
    const localRole = getLocalRoles()[user.id] as AppRole | undefined;
    const metadataRole = user.user_metadata?.['role'] as AppRole | undefined;

    const resolved = serverRole || metadataRole || localRole;

    if (resolved === 'admin') {
      userRole = 'admin';
      isAdmin = true;
      isPendingVerification = false;
    } else if (resolved && resolved !== 'pending') {
      userRole = resolved;
      isAdmin = false;
      isPendingVerification = false;
    } else {
      userRole = 'pending';
      isAdmin = false;
      isPendingVerification = true;
    }
  }

  const isRoleLoading = Boolean(user && !roleLoaded && !serverRole && !(user.user_metadata?.['role']) && !(getLocalRoles()[user.id]));

  // Only query factory data when user is authenticated and not pending verification
  const query = useQuery({
    queryKey: ['factory', user?.id ?? 'guest'],
    queryFn: readFactory,
    enabled: Boolean(user && userRole && userRole !== 'pending')
  });

  // Realtime subscription listens to zero-data change pings and profiles
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`factory-live-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'factory_data_pings' },
        () => {
          loadRole(user.id);
          cache.invalidateQueries({ queryKey: ['factory'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newRole = (payload.new as any)?.role;
          if (newRole) {
            setServerRole(newRole as AppRole);
            setServerAllowedPages((payload.new as any)?.allowed_pages || null);
          }
          loadRole(user.id);
          cache.invalidateQueries({ queryKey: ['factory'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => cache.invalidateQueries({ queryKey: ['factory'] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, cache]);

  const signIn = async () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const refresh = async () => {
    if (user?.id) {
      await loadRole(user.id);
    }
    await cache.invalidateQueries({ queryKey: ['factory'] });
  };

  const action = async (name: string, payload: Json) => {
    if (!user) {
      signIn();
      return false;
    }
    try {
      await runFactoryAction({ data: { action: name, payload } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not save record';
      if (msg.includes('42501') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('access denied')) {
        toast.error('Permission denied: your account role is not authorized to perform this action.');
      } else {
        toast.error(msg);
      }
      return false;
    }
    await refresh();
    toast.success('Saved successfully');
    return true;
  };

  const handoverRole = async (targetUserId: string, role: AppRole, allowedPages?: string[]) => {
    if (!user) {
      signIn();
      return false;
    }
    try {
      const { adminHandoverRole } = await import('@/lib/admin.functions');
      await adminHandoverRole({
        data: {
          targetUserId,
          role,
          ...(allowedPages !== undefined ? { allowedPages } : {})
        }
      });

      setLocalRole(targetUserId, role);
      await refresh();
      toast.success(role === 'user' ? 'User approved successfully' : `Role updated to ${role}`);
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not handover role');
      return false;
    }
  };

  const updateUserPageAccess = async (targetUserId: string, allowedPages: string[]) => {
    if (!user) {
      signIn();
      return false;
    }
    try {
      const { adminUpdateUserPageAccess } = await import('@/lib/admin.functions');
      await adminUpdateUserPageAccess({ data: { targetUserId, allowedPages } });

      await refresh();
      toast.success('Page access permissions updated successfully');
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update page access');
      return false;
    }
  };

  const revokeRole = async (targetUserId: string) => {
    if (!user) {
      signIn();
      return false;
    }
    try {
      const { adminRevokeRole } = await import('@/lib/admin.functions');
      await adminRevokeRole({ data: { targetUserId } });

      deleteLocalRole(targetUserId);
      await refresh();
      toast.success('Role revoked: user is now pending verification');
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke role');
      return false;
    }
  };

  // Tenant page access calculations
  const currentUserRoleRow = user ? (query.data?.roles ?? []).find(r => r.user_id === user.id) : null;
  const userAllowedPages: string[] = user
    ? (isAdmin
        ? [...DEFAULT_ROLE_PAGES.admin]
        : (serverAllowedPages !== null && Array.isArray(serverAllowedPages))
          ? serverAllowedPages
          : (currentUserRoleRow?.allowed_pages !== undefined && currentUserRoleRow?.allowed_pages !== null && Array.isArray(currentUserRoleRow.allowed_pages))
            ? currentUserRoleRow.allowed_pages
            : [...(DEFAULT_ROLE_PAGES[userRole || 'pending'] || [])])
    : [];

  const hasPageAccess = (pageKey: string): boolean => {
    if (!user) return false;
    if (isPendingVerification || userRole === 'pending') return false;
    if (isAdmin) return true;
    if (pageKey === 'admin' || pageKey === 'permissions') return false;
    return userAllowedPages.includes(pageKey);
  };

  const profile = user ? (query.data?.profiles ?? []).find(p => p.id === user.id) || null : null;
  const hasCapability = (capability: string) => roleHasCapability(userRole, capability);

  return (
    <FactoryContext.Provider
      value={{
        user,
        authInitialized,
        profile,
        data: query.data ?? emptyData,
        loading: query.isLoading,
        error: query.error?.message ?? null,
        signIn,
        refresh,
        action,
        userRole,
        isAdmin,
        isPendingVerification,
        isRoleLoading,
        userAllowedPages,
        hasPageAccess,
        hasCapability,
        handoverRole,
        updateUserPageAccess,
        revokeRole,
      }}
    >
      {children}
    </FactoryContext.Provider>
  );
}
