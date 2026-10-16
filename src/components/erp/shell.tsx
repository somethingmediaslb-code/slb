import {Link,useRouterState} from '@tanstack/react-router';
import {useState,useEffect,type ReactNode} from 'react';
import {
  Box,
  LayoutDashboard,
  ClipboardList,
  Factory,
  Truck,
  Building2,
  Package,
  Users,
  Wallet,
  ShieldCheck,
  Settings,
  ChevronRight,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  Phone,
  Mail,
  UserRound,
  AlertTriangle,
  Check,
  PanelLeft,
  Sun,
  Moon,
  BarChart3,
  KeyRound,
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';
import {useFactory} from './provider';
import {SegmentedMeter} from './common';
import {money} from '@/lib/erp-data';
import {supabase} from '@/integrations/supabase/client';
import {PendingVerificationPage} from './pending-verification';

export interface NotificationItem {
  id: string;
  actor: string;
  action: string;
  quote?: string | undefined;
  time: string;
  category: string;
  path?: string | undefined;
  type: 'production' | 'dispatch' | 'inventory' | 'orders' | 'labour' | 'system';
}

function timeAgo(dateString?: string | null): string {
  if (!dateString) return 'Just now';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

const defaultOperationalNotifications: NotificationItem[] = [
  {
    id: 'op-notif-1',
    actor: 'Production Line 1',
    action: 'completed run for 5,000 units',
    quote: 'Batch #B-8821 for Universal Packaging finished with 99.4% yield. Ready for strapping & dispatch.',
    time: '2m ago',
    category: 'Pending Production',
    path: '/production',
    type: 'production',
  },
  {
    id: 'op-notif-2',
    actor: 'Sarah from Logistics',
    action: 'flagged Challan #DC-1049 for gate dispatch',
    time: '18m ago',
    category: 'Dispatch & Delivery Challan',
    path: '/dispatch',
    type: 'dispatch',
  },
  {
    id: 'op-notif-3',
    actor: 'Packaging Timber Stock',
    action: 'dropped below safety threshold',
    time: '1h ago',
    category: 'Item Master',
    path: '/items',
    type: 'inventory',
  },
  {
    id: 'op-notif-4',
    actor: 'Emma Green',
    action: 'updated delivery schedule for Apex Consumer Goods',
    quote: 'Customer requested split dispatch: 6,000 wooden crates on Thursday, remaining 6,000 next Monday.',
    time: '3h ago',
    category: 'Order Entry',
    path: '/orders',
    type: 'orders',
  },
  {
    id: 'op-notif-5',
    actor: 'Noah Lee',
    action: 'verified morning shift muster for 24 operators',
    time: 'Yesterday',
    category: 'Labour Management',
    path: '/labour',
    type: 'labour',
  },
];

const renderNotifAvatar = (type: NotificationItem['type']) => {
  switch (type) {
    case 'production':
      return (
        <>
          <div className="notification-avatar" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
            <Factory size={16} />
          </div>
          <div className="notification-mini-badge" style={{ backgroundColor: '#27272a' }}>
            <Box size={9} className="text-white" />
          </div>
        </>
      );
    case 'dispatch':
      return (
        <>
          <div className="notification-avatar" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
            <Truck size={16} />
          </div>
          <div className="notification-mini-badge" style={{ backgroundColor: '#064e3b' }}>
            <Check size={9} className="text-emerald-400" />
          </div>
        </>
      );
    case 'inventory':
      return (
        <>
          <div className="notification-avatar" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
            <AlertTriangle size={16} />
          </div>
          <div className="notification-mini-badge" style={{ backgroundColor: '#450a0a' }}>
            <Package size={9} className="text-red-400" />
          </div>
        </>
      );
    case 'orders':
      return (
        <>
          <div className="notification-avatar" style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.25)' }}>
            <ClipboardList size={16} />
          </div>
          <div className="notification-mini-badge" style={{ backgroundColor: '#1e1b4b' }}>
            <Building2 size={9} className="text-indigo-400" />
          </div>
        </>
      );
    case 'labour':
      return (
        <>
          <div className="notification-avatar" style={{ backgroundColor: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', borderColor: 'rgba(14, 165, 233, 0.25)' }}>
            <Users size={16} />
          </div>
          <div className="notification-mini-badge" style={{ backgroundColor: '#082f49' }}>
            <Check size={9} className="text-sky-400" />
          </div>
        </>
      );
    default:
      return (
        <>
          <div className="notification-avatar" style={{ backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
            <ShieldCheck size={16} />
          </div>
          <div className="notification-mini-badge" style={{ backgroundColor: '#3b0764' }}>
            <Box size={9} className="text-purple-400" />
          </div>
        </>
      );
  }
};

export const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/orders', label: 'Order Entry', icon: ClipboardList, key: 'orders' },
  { to: '/production', label: 'Pending Production', icon: Factory, key: 'production' },
  { to: '/dispatch', label: 'Dispatch & Delivery Challan', icon: Truck, key: 'dispatch' },
] as const;

export const mastersNav = [
  { to: '/parties', label: 'Party Master', icon: Building2, key: 'parties' },
  { to: '/items', label: 'Item Master', icon: Package, key: 'catalog' },
  { to: '/labour', label: 'Labour Management', icon: Users, key: 'workers' },
] as const;

export const financeNav = [
  { to: '/expenses', label: 'Expenses & Borrowings', icon: Wallet, key: 'expenses' },
  { to: '/reports', label: 'Reports & Realised Profit', icon: BarChart3, key: 'reports' },
  { to: '/permissions', label: 'Page Permissions', icon: KeyRound, key: 'permissions' },
  { to: '/admin', label: 'Admin Panel', icon: ShieldCheck, key: 'admin' },
  { to: '/profile', label: 'Account Profile', icon: UserRound, key: 'profile' },
  { to: '/settings', label: 'Settings', icon: Settings, key: 'settings' }
] as const;

export const navigation = [
  ...mainNav,
  ...mastersNav,
  ...financeNav
] as const;

export function AppShell({children}:{children:ReactNode}){
  const path=useRouterState({select:s=>s.location.pathname});
  const [open,setOpen]=useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('slbw_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [alerts,setAlerts]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const {user,authInitialized,data,signIn,isPendingVerification,userRole,isAdmin,hasPageAccess}=useFactory();

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setOpen(prev => !prev);
    } else {
      setCollapsed(prev => {
        const next = !prev;
        try {
          localStorage.setItem('slbw_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('slbw_theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return document.documentElement.classList.contains('light') ? 'light' : 'dark';
    }
    return 'dark';
  });

  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('slbw_read_notifs') || '["op-notif-4", "op-notif-5"]');
    } catch {
      return ['op-notif-4', 'op-notif-5'];
    }
  });
  const [notifTab, setNotifTab] = useState<'all' | 'unread'>('all');

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(newTheme);
      root.setAttribute('data-theme', newTheme);
      root.style.colorScheme = newTheme;
      try {
        localStorage.setItem('slbw_theme', newTheme);
      } catch {}
    }
  };

  // If user is not authenticated, redirect to /login
  useEffect(() => {
    if (authInitialized && !user) {
      if (typeof window !== 'undefined') {
        const isAuthRoute = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/signup') || window.location.pathname.startsWith('/auth');
        if (!isAuthRoute) {
          window.location.href = '/login';
        }
      }
    }
  }, [authInitialized, user]);

  if (!authInitialized) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Loading SLBW workspace…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If user is authenticated but not yet approved by an admin
  if (user && isPendingVerification) {
    return <PendingVerificationPage />;
  }

  const userInitial=(user?.user_metadata['display_name']||user?.email||'U').slice(0,2).toUpperCase();
  const userName=user?.user_metadata['display_name']||user?.email?.split('@')[0];

  // Profile Drawer calculations
  const totalQueueValue = data.orders.reduce((sum, o) => {
    const items = data.items.filter(i => i.order_id === o.id);
    return sum + items.reduce((s, i) => s + (i.total_price ?? 0), 0);
  }, 0);
  const activeOrdersCount = data.orders.filter(o => o.status !== 'Completed').length;
  const totalCompletedOrders = data.orders.filter(o => o.status === 'Completed').length;
  const avgWin = data.orders.length > 0 ? Math.round((totalCompletedOrders / data.orders.length) * 100) : 51;
  const activeRunsCount = data.orders.filter(o => o.status === 'In Production' || o.status === 'Pending').length;

  const liveNotifications: NotificationItem[] = data.notifications.map(n => {
    const parts = n.title.split(' ');
    const actor = parts.slice(0, 2).join(' ');
    const action = parts.slice(2).join(' ') || 'updated status';
    const cat = n.path.startsWith('/production') ? 'Pending Production'
      : n.path.startsWith('/dispatch') ? 'Dispatch & Delivery Challan'
      : n.path.startsWith('/orders') ? 'Order Entry'
      : n.path.startsWith('/parties') ? 'Party Master'
      : n.path.startsWith('/items') ? 'Item Master'
      : n.path.startsWith('/labour') ? 'Labour Management'
      : n.path.startsWith('/expenses') ? 'Expenses & Borrowings'
      : 'System';

    const type: NotificationItem['type'] = n.path.startsWith('/production') ? 'production'
      : n.path.startsWith('/dispatch') ? 'dispatch'
      : n.path.startsWith('/items') ? 'inventory'
      : n.path.startsWith('/orders') ? 'orders'
      : n.path.startsWith('/labour') ? 'labour'
      : 'system';

    return {
      id: n.id,
      actor,
      action,
      quote: n.body || undefined,
      time: timeAgo(n.created_at),
      category: cat,
      path: n.path,
      type,
    };
  });

  const allNotifications = [...liveNotifications, ...defaultOperationalNotifications];
  const unreadCount = allNotifications.filter(n => !readNotifIds.includes(n.id)).length;
  const displayedNotifs = notifTab === 'unread'
    ? allNotifications.filter(n => !readNotifIds.includes(n.id))
    : allNotifications;

  const markAllAsRead = () => {
    const allIds = allNotifications.map(n => n.id);
    setReadNotifIds(allIds);
    try {
      localStorage.setItem('slbw_read_notifs', JSON.stringify(allIds));
    } catch {}
  };

  const handleNotificationClick = (item: NotificationItem) => {
    if (!readNotifIds.includes(item.id)) {
      const updated = [...readNotifIds, item.id];
      setReadNotifIds(updated);
      try {
        localStorage.setItem('slbw_read_notifs', JSON.stringify(updated));
      } catch {}
    }
    setAlerts(false);
  };

  const isNavActive = (target: string) => {
    if (target === '/') return path === '/';
    return path === target || path.startsWith(target + '/');
  };

  const getPageKeyFromPath = (p: string) => {
    if (p === '/') return 'dashboard';
    if (p.startsWith('/orders')) return 'orders';
    if (p.startsWith('/production')) return 'production';
    if (p.startsWith('/dispatch')) return 'dispatch';
    if (p.startsWith('/parties')) return 'parties';
    if (p.startsWith('/items')) return 'catalog';
    if (p.startsWith('/labour')) return 'workers';
    if (p.startsWith('/expenses')) return 'expenses';
    if (p.startsWith('/reports')) return 'reports';
    if (p.startsWith('/permissions')) return 'permissions';
    if (p.startsWith('/settings')) return 'settings';
    if (p.startsWith('/profile')) return 'profile';
    if (p.startsWith('/admin')) return 'admin';
    return null;
  };

  const currentPageKey = getPageKeyFromPath(path);
  const isPageDenied = Boolean(user && currentPageKey && !hasPageAccess(currentPageKey));

  const filteredMainNav = mainNav.filter(n => hasPageAccess(n.key));
  const filteredMastersNav = mastersNav.filter(n => hasPageAccess(n.key));
  const filteredFinanceNav = financeNav.filter(n => {
    if (n.key === 'admin' || n.key === 'permissions') return isAdmin;
    return hasPageAccess(n.key);
  });

  const fallbackAccessibleRoute = hasPageAccess('dashboard')
    ? '/'
    : (filteredMainNav[0]?.to || filteredMastersNav[0]?.to || filteredFinanceNav[0]?.to || '/');

  const current = navigation.find(n => isNavActive(n.to));
  const currentTitle = current?.label ?? 'Dashboard';

  if (typeof document !== 'undefined') {
    document.title = currentTitle ? `${currentTitle} | SLBW` : 'SLBW';
  }

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`} data-collapsed={collapsed ? "true" : "false"}>
      <div className={'mobile-scrim '+(open?'open':'')} onClick={()=>setOpen(false)}/>
      
      <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} data-collapsed={collapsed ? "true" : "false"}>
        <div className="sidebar-inner">
          {/* Brand Header - Matches topbar height (56px) */}
          <div className="brand-header">
            <Link className="brand-link" to="/" onClick={()=>setOpen(false)} title="SLBW Home">
              <div className="brand-text">
                <span className="brand-title">SLBW</span>
              </div>
            </Link>
            <button
              type="button"
              className="brand-collapse-btn hidden lg:flex"
              onClick={toggleSidebar}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft size={14} className={collapsed ? "rotate-180" : ""} />
            </button>
          </div>

          {/* Navigation Scroll Area */}
          <div className="sidebar-scroll">
            {/* Section 1: Production & Operations */}
            <div className="nav-section">
              <span className="nav-section-title">Production & Operations</span>
              <ul className="nav-list">
                {filteredMainNav.map(n => {
                  const active = isNavActive(n.to);
                  const count =
                    n.key === 'orders' ? data.orders.length
                    : n.key === 'production' ? activeRunsCount
                    : n.key === 'dispatch' ? data.challans.length
                    : undefined;

                  return (
                    <li key={n.to}>
                      <Link
                        to={n.to}
                        title={n.label}
                        data-active={active ? "true" : "false"}
                        className={'nav-link ' + (active ? 'active' : '')}
                        onClick={() => setOpen(false)}
                      >
                        <n.icon size={15} />
                        <span className="nav-label">{n.label}</span>
                        {count !== undefined && count > 0 && (
                          <span className="nav-count-badge">{count}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Section 2: Factory Masters */}
            {filteredMastersNav.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-title">Factory Masters</span>
                <ul className="nav-list">
                  {filteredMastersNav.map(n => {
                    const active = isNavActive(n.to);
                    const count =
                      n.key === 'parties' ? data.parties.length
                      : n.key === 'catalog' ? data.catalog.length
                      : n.key === 'workers' ? data.workers.length
                      : undefined;

                    return (
                      <li key={n.to}>
                        <Link
                          to={n.to}
                          title={n.label}
                          data-active={active ? "true" : "false"}
                          className={'nav-link ' + (active ? 'active' : '')}
                          onClick={() => setOpen(false)}
                        >
                          <n.icon size={15} />
                          <span className="nav-label">{n.label}</span>
                          {count !== undefined && count > 0 && (
                            <span className="nav-count-badge">{count}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Section 3: Ledger & System */}
            {filteredFinanceNav.length > 0 && (
              <div className="nav-section">
                <span className="nav-section-title">Ledger & System</span>
                <ul className="nav-list">
                  {filteredFinanceNav.map(n => {
                    const active = isNavActive(n.to);

                    return (
                      <li key={n.to}>
                        <Link
                          to={n.to}
                          title={n.label}
                          data-active={active ? "true" : "false"}
                          className={'nav-link ' + (active ? 'active' : '')}
                          onClick={() => setOpen(false)}
                        >
                          <n.icon size={15} />
                          <span className="nav-label">{n.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Bottom Capacity Card & User Profile */}
          <div className="sidebar-bottom">
            <div className="sidebar-capacity-card" title={`Plant Online: ${activeRunsCount} active production ${activeRunsCount === 1 ? 'run' : 'runs'}`}>
              <div className="capacity-text">
                <div className="capacity-title">
                  <span className="capacity-dot" /> Plant Online
                </div>
                <span className="capacity-sub">
                  {activeRunsCount} active production {activeRunsCount === 1 ? 'run' : 'runs'}
                </span>
              </div>
              <Link to="/orders" className="capacity-btn" onClick={() => setOpen(false)}>
                Orders
              </Link>
              <div className="capacity-collapsed-dot">
                <span className="capacity-dot" />
              </div>
            </div>

            {user ? (
              <div className="sidebar-user-row">
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="sidebar-user-trigger"
                  title={`${userName} (${user.user_metadata['job_title'] || userRole || 'User'})`}
                >
                  <span className="avatar !w-6 !h-6 !text-[10px] font-semibold bg-primary text-primary-foreground flex-shrink-0">
                    {userInitial}
                  </span>
                  <div className="truncate text-left min-w-0 user-details">
                    <div className="text-xs font-medium text-foreground truncate">{userName}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{user.user_metadata['job_title'] || (userRole === 'admin' ? 'Administrator' : (userRole || 'User'))}</div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={() => supabase.auth.signOut()}
                  className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive user-logout-btn"
                >
                  <LogOut size={13} />
                </Button>
              </div>
            ) : (
              <div className="p-2 border-t border-sidebar-border bg-sidebar">
                <Link to="/login" className="block w-full">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-7 text-xs border-border hover:bg-secondary">
                    <UserRound size={13} /> <span className="user-details">Sign in</span>
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="topbar-icon-btn shrink-0"
              aria-label={collapsed || !open ? 'Toggle navigation' : 'Close navigation'}
              title="Toggle menu"
              onClick={toggleSidebar}
            >
              <Menu size={15} />
            </button>
            <div className="topbar-page-heading truncate">
              <h1 className="topbar-title truncate" title={currentTitle}>
                {currentTitle}
              </h1>
            </div>
          </div>

          <div className="top-tools">
            <Link to="/orders" className="topbar-icon-btn" title="Search records">
              <Search size={14} />
            </Link>

            {/* Theme options: pill on sm+, compact single icon button on mobile */}
            <div className="hidden sm:inline-flex theme-switcher-pill" role="radiogroup" aria-label="Theme options">
              <button
                type="button"
                className={`theme-switcher-opt ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => toggleTheme('dark')}
                role="radio"
                aria-checked={theme === 'dark'}
                title="Dark theme"
              >
                <Moon size={12} />
                <span>Dark</span>
              </button>
              <button
                type="button"
                className={`theme-switcher-opt ${theme === 'light' ? 'active' : ''}`}
                onClick={() => toggleTheme('light')}
                role="radio"
                aria-checked={theme === 'light'}
                title="Light theme"
              >
                <Sun size={12} />
                <span>Light</span>
              </button>
            </div>

            <button
              type="button"
              className="sm:hidden topbar-icon-btn"
              onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <Popover open={alerts} onOpenChange={setAlerts}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="topbar-icon-btn relative cursor-pointer"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell size={14} />
                  {unreadCount > 0 && <span className="topbar-unread-badge" />}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="notification-popover"
              >
                {/* Header */}
                <div className="notification-header">
                  <div className="notification-title-wrap">
                    <span className="notification-title">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="notification-badge-count">{unreadCount}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="notification-mark-all"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {/* Tabs */}
                <div className="notification-tabs">
                  <button
                    type="button"
                    onClick={() => setNotifTab('all')}
                    className={`notification-tab-btn ${notifTab === 'all' ? 'active' : ''}`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifTab('unread')}
                    className={`notification-tab-btn ${notifTab === 'unread' ? 'active' : ''}`}
                  >
                    Unread
                  </button>
                </div>

                {/* Notification List */}
                <div className="notification-list-scroll">
                  {displayedNotifs.length > 0 ? (
                    displayedNotifs.map(item => {
                      const isUnread = !readNotifIds.includes(item.id);
                      const content = (
                        <>
                          <div className="notification-avatar-wrap">
                            {renderNotifAvatar(item.type)}
                          </div>
                          <div className="notification-card-body">
                            <div className="notification-top-row">
                              <div className="notification-text">
                                <strong>{item.actor}</strong> {item.action}
                              </div>
                              {isUnread && <span className="notification-unread-dot" />}
                            </div>
                            {item.quote && (
                              <div className="notification-quote-bubble">
                                {item.quote}
                              </div>
                            )}
                            <div className="notification-meta-row">
                              <span>{item.time}</span>
                              <span>·</span>
                              <span>{item.category}</span>
                            </div>
                          </div>
                        </>
                      );

                      if (item.path) {
                        return (
                          <Link
                            key={item.id}
                            to={item.path}
                            className="notification-card"
                            onClick={() => handleNotificationClick(item)}
                          >
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className="notification-card"
                          onClick={() => handleNotificationClick(item)}
                        >
                          {content}
                        </div>
                      );
                    })
                  ) : (
                    <div className="notification-empty">
                      {notifTab === 'unread'
                        ? 'No unread notifications'
                        : 'No notifications yet'}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {user ? (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="topbar-profile-btn"
                title="Account profile"
              >
                <span className="avatar !w-5 !h-5 !text-[10px] font-semibold bg-primary text-primary-foreground">
                  {userInitial}
                </span>
                <span className="hidden sm:inline font-normal truncate max-w-[120px]">
                  {userName}
                </span>
              </button>
            ) : (
              <Link to="/login" className="no-underline">
                <button type="button" className="topbar-profile-btn" title="Sign in" aria-label="Sign in">
                  <UserRound size={13} />
                  <span className="hidden sm:inline">Sign in</span>
                </button>
              </Link>
            )}
          </div>
        </header>

        <main className="page-body">
          {isPageDenied ? (
            <div className="p-8 border border-border rounded-2xl bg-card text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive grid place-items-center mx-auto">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Tenant Page Access Restricted</h2>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Your workspace administrator has not granted your account permission to view the <strong>{currentTitle}</strong> page.
                  Factory operations and records for this section are strictly tenant-isolated.
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <Link to={fallbackAccessibleRoute}>
                  <Button variant="default" className="rounded-full shadow-none px-6">
                    {hasPageAccess('dashboard') ? 'Return to Dashboard' : 'Go to Available Workspace Page'}
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Slide-over My Profile Sheet */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full p-0 flex flex-col bg-card overflow-hidden">
          {user && (
            <>
              <div className="p-6 border-b border-border bg-background">
                <SheetHeader className="text-left space-y-3">
                  <SheetTitle className="text-base font-semibold">My Profile</SheetTitle>
                  <div className="profile-hero">
                    <div className="profile-avatar-lg">
                      {userInitial}
                    </div>
                    <div>
                      <div className="text-lg font-medium text-foreground">{userName}</div>
                      <div className="text-xs text-muted-foreground">{user.user_metadata['job_title'] || (userRole === 'admin' ? 'Administrator' : (userRole || 'User'))}</div>
                    </div>
                  </div>
                </SheetHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Contact Section */}
                <div>
                  <div className="drawer-section-label">Contact</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-foreground">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{user.user_metadata['phone'] || '+91 (982) 001-2345'}</span>
                    </div>
                  </div>
                </div>

                {/* Factory Queue Section (Screenshot 3: 2x2 grid) */}
                <div>
                  <div className="drawer-section-label">Factory Queue</div>
                  <div className="drawer-metric-grid-4">
                    <div className="drawer-metric-cell">
                      <small>Accounts</small>
                      <strong>{data.parties.length}</strong>
                    </div>
                    <div className="drawer-metric-cell">
                      <small>Active Orders</small>
                      <strong>{activeOrdersCount}</strong>
                    </div>
                    <div className="drawer-metric-cell">
                      <small>Queue Value</small>
                      <strong>{money(totalQueueValue)}</strong>
                    </div>
                    <div className="drawer-metric-cell">
                      <small>Avg. Fulfilment</small>
                      <strong>{avgWin}%</strong>
                    </div>
                  </div>
                </div>

                {/* Team Accounts Section (Screenshot 3) */}
                <div>
                  <div className="drawer-section-label">Top Accounts</div>
                  <div className="space-y-2">
                    {data.parties.slice(0, 5).map(party => {
                      const pOrders = data.orders.filter(o => o.party_id === party.id);
                      const pSpend = pOrders.reduce((sum, o) => {
                        const items = data.items.filter(i => i.order_id === o.id);
                        return sum + items.reduce((s, i) => s + (i.total_price ?? 0), 0);
                      }, 0);
                      const pDone = pOrders.filter(o => o.status === 'Completed').length;
                      return (
                        <div key={party.id} className="profile-account-item text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="avatar !w-7 !h-7 !text-[11px] font-semibold bg-accent flex-shrink-0">
                              {party.company_name.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <span className="font-medium text-foreground block truncate">{party.company_name}</span>
                              <span className="text-[11px] text-muted-foreground truncate block">
                                {pOrders.length} runs · {party.gstin ? 'GST Verified' : 'Standard'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-medium text-foreground text-xs">{money(pSpend)}</div>
                            <div className="mt-1">
                              <SegmentedMeter value={pDone} total={Math.max(pOrders.length, 1)} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Pinned Footer */}
              <div className="p-4 border-t border-border bg-background flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={() => setProfileOpen(false)}>
                  Close
                </Button>
                <Link to="/parties" onClick={() => setProfileOpen(false)}>
                  <Button variant="default" size="sm">
                    Show all accounts
                  </Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
