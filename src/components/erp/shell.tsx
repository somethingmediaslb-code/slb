import {Link,useRouterState} from '@tanstack/react-router';
import {useState,type ReactNode} from 'react';
import {Box,LayoutDashboard,Building2,Package,ClipboardList,Factory,Users,Truck,Wallet,ShieldCheck,UserRound,Settings,ChevronRight,Search,Bell,Menu,X,LogOut,Phone,Mail} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {Sheet,SheetContent,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {useFactory} from './provider';
import {SegmentedMeter} from './common';
import {money} from '@/lib/erp-data';
import {supabase} from '@/integrations/supabase/client';

export const mainNav=[
  {to:'/',label:'Dashboard',icon:LayoutDashboard,key:'dashboard'},
  {to:'/orders',label:'Order Pipeline',icon:ClipboardList,key:'orders'},
  {to:'/production',label:'Production Floor',icon:Factory,key:'production'},
  {to:'/dispatch',label:'Dispatch & Logistics',icon:Truck,key:'dispatch'},
] as const;

export const mastersNav=[
  {to:'/parties',label:'Party / Clients',icon:Building2,key:'parties'},
  {to:'/items',label:'Item Catalog',icon:Package,key:'catalog'},
  {to:'/labour',label:'Labour & Teams',icon:Users,key:'workers'},
] as const;

export const financeNav=[
  {to:'/expenses',label:'Expenses & Ledger',icon:Wallet},
  {to:'/admin',label:'Admin Panel',icon:ShieldCheck},
  {to:'/settings',label:'Settings',icon:Settings}
] as const;

export const navigation=[
  ...mainNav,
  ...mastersNav,
  ...financeNav,
  {to:'/profile',label:'Account Profile',icon:UserRound}
] as const;

export function AppShell({children}:{children:ReactNode}){
  const path=useRouterState({select:s=>s.location.pathname});
  const current=navigation.find(n=>n.to===path);
  const [open,setOpen]=useState(false);
  const [alerts,setAlerts]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const {user,data,signIn}=useFactory();

  const userInitial=(user?.user_metadata['display_name']||user?.email||'U').slice(0,2).toUpperCase();
  const userName=user?.user_metadata['display_name']||user?.email?.split('@')[0];

  // Profile Drawer calculations (Screenshot 3)
  const totalPipeline = data.orders.reduce((sum, o) => {
    const items = data.items.filter(i => i.order_id === o.id);
    return sum + items.reduce((s, i) => s + (i.total_price ?? 0), 0);
  }, 0);
  const openDealsCount = data.orders.filter(o => o.status !== 'Completed').length;
  const totalCompletedOrders = data.orders.filter(o => o.status === 'Completed').length;
  const avgWin = data.orders.length > 0 ? Math.round((totalCompletedOrders / data.orders.length) * 100) : 51;
  const activeRunsCount = data.orders.filter(o => o.status === 'In Production').length;

  return (
    <div className="app-shell">
      <div className={'mobile-scrim '+(open?'open':'')} onClick={()=>setOpen(false)}/>
      
      <aside className={'sidebar '+(open?'open':'')}>
        <Link className="brand-header" to="/">
          <div className="brand-icon"><Box size={20}/></div>
          <div>
            <div className="brand-title">CrateERP</div>
            <div className="brand-sub">Manufacturing pipeline</div>
          </div>
        </Link>

        <div className="nav-section-title">Pipelines & Operations</div>
        <nav aria-label="Main navigation">
          {mainNav.map(n => {
            const count = n.key === 'orders' ? data.orders.length
              : n.key === 'production' ? data.orders.filter(o => o.status === 'In Production' || o.status === 'Pending').length
              : n.key === 'dispatch' ? data.challans.length
              : undefined;
            return (
              <Link key={n.to} to={n.to} className={'nav-link '+(path===n.to?'active':'')} onClick={()=>setOpen(false)}>
                <n.icon/>
                <span>{n.label}</span>
                {count !== undefined && count > 0 && <span className="nav-count-badge">{count}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="nav-section-title">Factory Masters</div>
        <nav aria-label="Masters navigation">
          {mastersNav.map(n => {
            const count = n.key === 'parties' ? data.parties.length
              : n.key === 'catalog' ? data.catalog.length
              : n.key === 'workers' ? data.workers.length
              : undefined;
            return (
              <Link key={n.to} to={n.to} className={'nav-link '+(path===n.to?'active':'')} onClick={()=>setOpen(false)}>
                <n.icon/>
                <span>{n.label}</span>
                {count !== undefined && count > 0 && <span className="nav-count-badge">{count}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="nav-section-title">Ledger & System</div>
        <nav aria-label="System navigation">
          {financeNav.map(n => (
            <Link key={n.to} to={n.to} className={'nav-link '+(path===n.to?'active':'')} onClick={()=>setOpen(false)}>
              <n.icon/>
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-capacity-card">
            <div>
              <div className="capacity-title">
                <span className="capacity-dot"/> Plant Online
              </div>
              <div className="capacity-sub">
                {activeRunsCount} Active Corrugator Runs
              </div>
            </div>
            <Link to="/orders" className="capacity-btn">
              Pipeline
            </Link>
          </div>
          {user ? (
            <div className="flex items-center gap-2 p-1 bg-card border border-border rounded-lg">
              <button
                type="button"
                onClick={()=>setProfileOpen(true)}
                className="flex-1 flex items-center gap-2.5 p-1 rounded hover:bg-secondary transition-colors no-underline text-foreground min-w-0 text-left border-0 bg-transparent cursor-pointer"
              >
                <span className="avatar !w-8 !h-8 !text-xs font-semibold bg-primary text-primary-foreground flex-shrink-0">
                  {userInitial}
                </span>
                <div className="truncate">
                  <div className="text-xs font-medium truncate">{userName}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{user.user_metadata['role'] || 'Member'}</div>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
                onClick={()=>supabase.auth.signOut()}
                className="flex-shrink-0 text-muted-foreground hover:text-destructive"
              >
                <LogOut size={16}/>
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full justify-start gap-2" onClick={signIn}>
              <UserRound size={16}/> Sign in
            </Button>
          )}
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button variant="ghost" size="icon" className="mobile-menu" aria-label={open?'Close navigation':'Open navigation'} onClick={()=>setOpen(!open)}>
              {open?<X/>:<Menu/>}
            </Button>
            <span>Workspace</span>
            <ChevronRight size={14}/>
            <span>{current?.label??'Reports'}</span>
          </div>

          <div className="top-tools">
            <Link to="/orders" className="top-search text-muted-foreground no-underline">
              <Search size={16}/><span>Search orders</span>
            </Link>

            <Button size="icon" variant="ghost" aria-label="Notifications" title="Notifications" onClick={()=>setAlerts(true)}>
              <Bell size={18}/>
            </Button>

            {user ? (
              <button
                type="button"
                onClick={()=>setProfileOpen(true)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1 bg-card border border-border rounded-full hover:bg-secondary transition-colors text-foreground cursor-pointer"
                title="Account profile"
              >
                <span className="avatar !w-7 !h-7 !text-[11px] font-semibold bg-primary text-primary-foreground">
                  {userInitial}
                </span>
                <span className="text-xs font-medium max-w-[120px] truncate hidden sm:inline">
                  {userName}
                </span>
              </button>
            ) : (
              <Button size="sm" variant="outline" onClick={signIn}>
                <UserRound className="w-3.5 h-3.5 mr-1.5"/> Sign in
              </Button>
            )}
          </div>
        </header>

        <main className="page-body">{children}</main>
      </div>

      <Dialog open={alerts} onOpenChange={setAlerts}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Notifications</DialogTitle>
          <div className="notification-list">
            {data.notifications.length ? data.notifications.slice().reverse().map(n=>(
              <div className="notification-item" key={n.id}>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </div>
            )) : (
              <p className="text-muted-foreground py-8 text-center">No notifications yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Slide-over My Profile Sheet (Screenshot 3) */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full p-0 flex flex-col bg-card overflow-hidden">
          {user && (
            <>
              <div className="p-6 border-b border-border bg-background">
                <SheetHeader className="text-left space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <UserRound className="w-4 h-4 text-primary" />
                    <SheetTitle className="text-base font-semibold">My Profile</SheetTitle>
                  </div>
                  <div className="profile-hero">
                    <div className="profile-avatar-lg">
                      {userInitial}
                    </div>
                    <div>
                      <div className="text-lg font-medium text-foreground">{userName}</div>
                      <div className="text-xs text-muted-foreground">{user.user_metadata['role'] || 'Plant Director / Head of Sales'}</div>
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

                {/* Team Pipeline Section (Screenshot 3: 2x2 grid) */}
                <div>
                  <div className="drawer-section-label">Team Pipeline</div>
                  <div className="drawer-metric-grid-4">
                    <div className="drawer-metric-cell">
                      <small>Accounts</small>
                      <strong>{data.parties.length}</strong>
                    </div>
                    <div className="drawer-metric-cell">
                      <small>Open Deals</small>
                      <strong>{openDealsCount}</strong>
                    </div>
                    <div className="drawer-metric-cell">
                      <small>Pipeline</small>
                      <strong>{money(totalPipeline)}</strong>
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
