import { useState, useEffect, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  Shield,
  RefreshCw,
  Save,
  Search,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  ClipboardList,
  Factory,
  Truck,
  Building2,
  Package,
  Users,
  Wallet,
  BarChart3,
  UserRound,
  Settings as SettingsIcon,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFactory, ALL_PAGE_KEYS, DEFAULT_ROLE_PAGES, type AppRole } from './provider';
import { Heading, AccessNotice } from './common';
import { supabase } from '@/integrations/supabase/client';
import { adminListUsers, type AdminUserRecord } from '@/lib/admin.functions';

interface PageItem {
  key: string;
  label: string;
  path: string;
  description: string;
  icon: typeof LayoutDashboard;
}

interface PageCategory {
  id: string;
  name: string;
  pages: PageItem[];
}

const CATEGORIES: PageCategory[] = [
  {
    id: 'operations',
    name: 'Production & Operations',
    pages: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        path: '/',
        description: 'Queue metrics, factory run overview, and activity monitor',
        icon: LayoutDashboard,
      },
      {
        key: 'orders',
        label: 'Order Entry',
        path: '/orders',
        description: 'Client purchase orders, box specifications, and delivery schedules',
        icon: ClipboardList,
      },
      {
        key: 'production',
        label: 'Pending Production',
        path: '/production',
        description: 'Work order allocations, worker assignments, and batch tracking',
        icon: Factory,
      },
      {
        key: 'dispatch',
        label: 'Dispatch & Delivery Challan',
        path: '/dispatch',
        description: 'Delivery challans, vehicle dispatch notes, and gate passes',
        icon: Truck,
      },
    ],
  },
  {
    id: 'masters',
    name: 'Factory Masters',
    pages: [
      {
        key: 'parties',
        label: 'Party Master',
        path: '/parties',
        description: 'Client and vendor directory, billing contacts, and GSTIN records',
        icon: Building2,
      },
      {
        key: 'catalog',
        label: 'Item Master',
        path: '/items',
        description: 'Corrugated box catalog, dimensions, ply ratings, and rate sheets',
        icon: Package,
      },
      {
        key: 'workers',
        label: 'Labour Management',
        path: '/labour',
        description: 'Factory labour directory, piece rates, daily attendance, and payroll',
        icon: Users,
      },
    ],
  },
  {
    id: 'finance',
    name: 'Finance & Analytics',
    pages: [
      {
        key: 'expenses',
        label: 'Expenses & Borrowings',
        path: '/expenses',
        description: 'Operating overheads, maintenance expenses, and labour advances',
        icon: Wallet,
      },
      {
        key: 'reports',
        label: 'Reports & Realised Profit',
        path: '/reports',
        description: 'Order-level realised profit calculator and operational analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    id: 'system',
    name: 'System & Preferences',
    pages: [
      {
        key: 'profile',
        label: 'Account Profile',
        path: '/profile',
        description: 'User details, job title, assigned factory runs, and session info',
        icon: UserRound,
      },
      {
        key: 'settings',
        label: 'Settings',
        path: '/settings',
        description: 'PWA installation, device notifications, and app preferences',
        icon: SettingsIcon,
      },
    ],
  },
];

export function PagePermissions() {
  const { user, isAdmin, updateUserPageAccess } = useFactory();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [localAllowed, setLocalAllowed] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await adminListUsers();
      if (res.success && res.users) {
        setUsers(res.users);
        if (!selectedUserId && res.users.length > 0) {
          const fallbackUser = res.users[0];
          const preferred = res.users.find((u) => u.role !== 'admin') || fallbackUser;
          const initialId = preferred ? preferred.id : undefined;
          if (initialId) {
            setSelectedUserId(initialId);
          }
        }
      }
    } catch {
      toast.error('Could not load user list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  useEffect(() => {
    if (selectedUser) {
      if (selectedUser.role === 'admin') {
        setLocalAllowed(ALL_PAGE_KEYS.map((p) => p.key));
      } else {
        const pages =
          selectedUser.allowed_pages && Array.isArray(selectedUser.allowed_pages)
            ? selectedUser.allowed_pages
            : DEFAULT_ROLE_PAGES[selectedUser.role] || DEFAULT_ROLE_PAGES.user;
        setLocalAllowed([...pages]);
      }
      setHasChanges(false);
    } else {
      setLocalAllowed([]);
      setHasChanges(false);
    }
  }, [selectedUser]);

  // Real-time synchronization
  useEffect(() => {
    const channel = supabase
      .channel('permissions-page-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        (payload) => {
          const updatedUserId = (payload.new as any)?.user_id;
          const updatedAllowedPages = (payload.new as any)?.allowed_pages;
          const updatedRole = (payload.new as any)?.role;

          setUsers((prev) =>
            prev.map((u) => {
              if (u.id === updatedUserId) {
                return {
                  ...u,
                  ...(updatedRole ? { role: updatedRole } : {}),
                  ...(updatedAllowedPages !== undefined ? { allowed_pages: updatedAllowedPages } : {}),
                };
              }
              return u;
            })
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'factory_data_pings' },
        () => loadUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleToggle = (pageKey: string) => {
    if (selectedUser?.role === 'admin') {
      toast.info('Administrators have access to all pages by default');
      return;
    }

    setLocalAllowed((prev) => {
      const next = prev.includes(pageKey)
        ? prev.filter((k) => k !== pageKey)
        : [...prev, pageKey];
      return next;
    });
    setHasChanges(true);
  };

  const handleToggleCategory = (categoryPages: PageItem[]) => {
    if (selectedUser?.role === 'admin') return;

    const keys = categoryPages.map((p) => p.key);
    const allSelected = keys.every((k) => localAllowed.includes(k));

    setLocalAllowed((prev) => {
      if (allSelected) {
        return prev.filter((k) => !keys.includes(k));
      }
      const set = new Set([...prev, ...keys]);
      return Array.from(set);
    });
    setHasChanges(true);
  };

  const handleSelectAll = () => {
    if (selectedUser?.role === 'admin') return;
    setLocalAllowed(ALL_PAGE_KEYS.map((p) => p.key));
    setHasChanges(true);
  };

  const handleDeselectAll = () => {
    if (selectedUser?.role === 'admin') return;
    setLocalAllowed([]);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedUserId || !selectedUser) return;
    if (selectedUser.role === 'admin') return;

    setSaving(true);
    try {
      const ok = await updateUserPageAccess(selectedUserId, localAllowed);
      if (ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === selectedUserId ? { ...u, allowed_pages: localAllowed } : u))
        );
        setHasChanges(false);
        toast.success(`Permissions saved for ${selectedUser.display_name || selectedUser.email}`);
      } else {
        toast.error('Failed to save permissions');
      }
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      pages: cat.pages.filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          p.path.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.pages.length > 0);
  }, [search]);

  if (!isAdmin) {
    return (
      <div className="settings-page">
        <Heading title="Page Permissions" />
        <AccessNotice />
        <div className="p-8 border border-border rounded-xl bg-card text-center space-y-4 max-w-sm mx-auto my-12">
          <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Administrator Access Required</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Only workspace administrators can govern page permissions.
            </p>
          </div>
          <Link to="/" className="block w-full">
            <Button variant="default" size="sm" className="w-full">
              Return to Workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">User Permissions</h1>
          <p className="text-xs text-muted-foreground">
            Configure page visibility and module access per user
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving || selectedUser?.role === 'admin'}
            className="h-8 text-xs gap-1.5 font-medium"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      {/* User Selection & Controls Toolbar */}
      <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-muted-foreground font-medium shrink-0">User:</span>

          <Select
            value={selectedUserId || ''}
            onValueChange={(val) => setSelectedUserId(val || null)}
            disabled={loading}
          >
            <SelectTrigger className="w-full sm:w-72 h-8 text-xs bg-secondary/50 border-border">
              <SelectValue placeholder={loading ? 'Loading…' : 'Select user…'} />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  <span className="font-medium text-foreground">{u.email}</span>
                  {u.display_name && (
                    <span className="text-muted-foreground ml-1.5">({u.display_name})</span>
                  )}
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground uppercase">
                    [{u.role}]
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedUser && selectedUser.role !== 'admin' && (
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer text-xs"
              >
                Select all
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer text-xs"
              >
                Deselect all
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {hasChanges && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 w-40 text-xs rounded-lg border border-border bg-secondary/50 placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 transition-colors"
            />
          </div>

          <span className="text-xs text-muted-foreground font-mono bg-secondary px-2.5 py-1 rounded-md border border-border shrink-0">
            {selectedUser?.role === 'admin'
              ? 'All 11 allowed'
              : `${localAllowed.length} / ${ALL_PAGE_KEYS.length} allowed`}
          </span>
        </div>
      </div>

      {/* Admin Notice Banner if Admin */}
      {selectedUser?.role === 'admin' && (
        <div className="p-3 rounded-lg border border-border bg-secondary/50 text-xs text-muted-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>{selectedUser.email}</strong> is an Administrator with unrestricted access to all modules and tools.
          </span>
        </div>
      )}

      {/* Permissions List */}
      {selectedUser ? (
        <div className="space-y-4">
          {filteredCategories.map((category) => {
            const catKeys = category.pages.map((p) => p.key);
            const allCatSelected = catKeys.every((k) => localAllowed.includes(k));
            const someCatSelected = catKeys.some((k) => localAllowed.includes(k));

            return (
              <div
                key={category.id}
                className="rounded-xl border border-border bg-card overflow-hidden shadow-xs"
              >
                {/* Section Header */}
                <div className="px-4 py-2.5 bg-secondary/30 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {category.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      ({category.pages.length})
                    </span>
                  </div>

                  {selectedUser.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleToggleCategory(category.pages)}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {allCatSelected ? 'Uncheck section' : 'Check section'}
                    </button>
                  )}
                </div>

                {/* Page Rows */}
                <div className="divide-y divide-border/60">
                  {category.pages.map((page) => {
                    const isAllowed = localAllowed.includes(page.key);
                    const Icon = page.icon;

                    return (
                      <div
                        key={page.key}
                        onClick={() => handleToggle(page.key)}
                        className={cn(
                          'px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors',
                          isAllowed ? 'hover:bg-secondary/30' : 'hover:bg-secondary/20 opacity-70 hover:opacity-100'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
                              isAllowed
                                ? 'bg-primary/10 border-primary/20 text-primary'
                                : 'bg-secondary border-border text-muted-foreground'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground truncate">
                                {page.label}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">
                                {page.path}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {page.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={cn(
                              'text-[11px] font-medium hidden sm:inline',
                              isAllowed ? 'text-primary' : 'text-muted-foreground'
                            )}
                          >
                            {isAllowed ? 'Allowed' : 'Restricted'}
                          </span>

                          <Switch
                            id={`perm-${page.key}`}
                            checked={isAllowed}
                            disabled={selectedUser.role === 'admin'}
                            onCheckedChange={() => handleToggle(page.key)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 border border-border rounded-xl bg-card text-center text-muted-foreground space-y-2">
          <Shield className="w-8 h-8 mx-auto opacity-40" />
          <p className="text-xs">Select a user above to configure their permissions.</p>
        </div>
      )}
    </div>
  );
}
