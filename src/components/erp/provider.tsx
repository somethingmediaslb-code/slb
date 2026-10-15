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

export type AppRole = 'admin' | 'manager' | 'supervisor' | 'accountant' | 'dispatch_clerk' | 'viewer' | 'pending';

export function roleHasCapability(role: AppRole | null | undefined, cap: string): boolean {
  if (role === 'admin') return true;
  if (!role || role === 'pending') return false;
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

// Queries read from sanitized views (v_*) for column-level privacy
const tables = {
  parties: 'v_party_master',
  catalog: 'v_item_master',
  orders: 'v_orders',
  items: 'v_order_items',
  workers: 'labour_master',
  allocations: 'v_production_allocations',
  challans: 'v_delivery_challans',
  challanItems: 'v_challan_items',
  expenses: 'v_expenses',
  borrowings: 'v_labour_borrowings',
  payroll: 'v_labour_payroll',
  notifications: 'factory_notifications',
  roles: 'user_roles',
  profiles: 'profiles'
} as const;

async function readFactory(): Promise<FactoryData> {
  const result = { ...emptyData };
  await Promise.all(
    Object.entries(tables).map(async ([key, table]) => {
      let { data, error } = await (supabase.from as any)(table).select('*');
      if (error && table.startsWith('v_')) {
        // Graceful fallback to the underlying base table if the sanitized view is not yet compiled
        const baseTable = table.replace(/^v_/, '');
        const fallback = await (supabase.from as any)(baseTable).select('*');
        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }
      if (error) {
        console.warn(`Query on ${table} failed:`, error.message);
        Object.assign(result, { [key]: [] });
        return;
      }
      Object.assign(result, { [key]: data ?? [] });
    })
  );

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
  hasCapability: (capability: string) => boolean;
  handoverRole: (targetUserId: string, role: AppRole) => Promise<boolean>;
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
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['factory', user?.id ?? 'guest'],
    queryFn: readFactory,
    enabled: true
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) {
        setUser(session?.user ?? null);
        if (event === 'SIGNED_OUT') cache.removeQueries({ queryKey: ['factory'] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [cache]);

  // Realtime subscription listens to zero-data change pings, user_roles and profiles
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`factory-live-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'factory_data_pings' },
        () => cache.invalidateQueries({ queryKey: ['factory'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => cache.invalidateQueries({ queryKey: ['factory'] })
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
  }, [user, cache]);

  const signIn = async () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const refresh = async () => {
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

  const handoverRole = async (targetUserId: string, role: AppRole) => {
    if (!user) {
      signIn();
      return false;
    }
    try {
      try {
        const { adminHandoverRole } = await import('@/lib/admin.functions');
        await adminHandoverRole({ data: { targetUserId, role } });
      } catch (err) {
        console.warn('Server function handover fallback:', err);
        // Call RPC admin_set_user_role directly
        const { error: rpcErr } = await supabase.rpc('admin_set_user_role', {
          target_user_id: targetUserId,
          new_role: role
        });
        if (rpcErr) throw rpcErr;
      }

      setLocalRole(targetUserId, role);
      await refresh();
      toast.success(`Role updated successfully to ${role}`);
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not handover role');
      return false;
    }
  };

  const revokeRole = async (targetUserId: string) => {
    if (!user) {
      signIn();
      return false;
    }
    try {
      try {
        const { adminRevokeRole } = await import('@/lib/admin.functions');
        await adminRevokeRole({ data: { targetUserId } });
      } catch (err) {
        console.warn('Server function revoke fallback:', err);
        const { error: rpcErr } = await supabase.rpc('admin_set_user_role', {
          target_user_id: targetUserId,
          new_role: 'pending'
        });
        if (rpcErr) throw rpcErr;
      }

      deleteLocalRole(targetUserId);
      await refresh();
      toast.success('Role revoked: user is now pending verification');
      return true;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not revoke role');
      return false;
    }
  };

  // Determine current user's role status
  let userRole: AppRole | null = null;
  let isAdmin = false;
  let isPendingVerification = false;

  if (user) {
    const rolesList = query.data?.roles ?? [];
    const dbRole = rolesList.find(r => r.user_id === user.id)?.role as AppRole | undefined;
    const localRole = getLocalRoles()[user.id] as AppRole | undefined;
    const metadataRole = user.user_metadata?.['role'] as AppRole | undefined;

    const resolved = dbRole || localRole || metadataRole;

    const totalAdmins = rolesList.filter(r => r.role === 'admin').length;
    const isFirstBootstrapUser = totalAdmins === 0 && !resolved;

    if (resolved === 'admin' || isFirstBootstrapUser) {
      userRole = 'admin';
      isAdmin = true;
      isPendingVerification = false;
      if (isFirstBootstrapUser && typeof window !== 'undefined') {
        setLocalRole(user.id, 'admin');
      }
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

  const profile = user ? (query.data?.profiles ?? []).find(p => p.id === user.id) || null : null;
  const hasCapability = (capability: string) => roleHasCapability(userRole, capability);

  return (
    <FactoryContext.Provider
      value={{
        user,
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
        hasCapability,
        handoverRole,
        revokeRole,
      }}
    >
      {children}
    </FactoryContext.Provider>
  );
}
