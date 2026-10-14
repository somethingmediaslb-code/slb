import {useEffect,useState,type FormEvent} from 'react';
import {Link} from '@tanstack/react-router';
import {
  Bell,
  Trash2,
  LogOut,
  ShieldCheck,
  UserRound,
  Mail,
  Phone,
  Briefcase,
  CheckCircle2,
  UserPlus,
  UserCheck,
  UserX,
  ArrowRightLeft,
  Clock,
  RefreshCw,
  Download,
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import {useFactory} from './provider';
import {Heading,AccessNotice,Empty,Pill,SearchFilter,Pagination} from './common';
import {supabase} from '@/integrations/supabase/client';
import {enablePush,disablePush} from '@/lib/push';
import {deleteMyAccount} from '@/lib/push.functions';
import {toast} from 'sonner';
import type {AdminUserRecord} from '@/lib/admin.functions';

export function Settings(){
  const {user,signIn}=useFactory();
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [installPrompt,setInstallPrompt]=useState<any>(null);
  const [isStandalone,setIsStandalone]=useState(false);

  useEffect(()=>{
    navigator.serviceWorker?.getRegistration('/messaging-sw.js').then(r=>r?.pushManager.getSubscription()).then(s=>setEnabled(!!s));
    if (typeof window !== 'undefined') {
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
      const handler = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  },[]);

  async function installPwa(){
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        toast.success('PWA installed successfully');
        setInstallPrompt(null);
      }
    } else {
      toast.info('App is already installed or accessible from your browser menu');
    }
  }

  async function toggle(){
    if(!user){signIn();return;}
    setBusy(true);
    try{
      if(enabled){
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush();
        setEnabled(true);
      }
      toast.success(enabled?'Notifications disabled':'Notifications enabled');
    }catch(e){
      toast.error(e instanceof Error?e.message:'Notification settings could not be saved');
    }finally{
      setBusy(false);
    }
  }

  async function remove(){
    if(!user){signIn();return;}
    if(!window.confirm('Permanently delete your account? This cannot be undone.'))return;
    try{
      await deleteMyAccount();
      await supabase.auth.signOut();
      toast.success('Account deleted');
    }catch(e){
      toast.error(e instanceof Error?e.message:'Could not delete account');
    }
  }

  return (
    <div className="settings-container">
      <Heading title="Settings"/>

      <div className="settings-card">
        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-icon-box">
              <Download className="size-4 text-foreground"/>
            </div>
            <div>
              <div className="settings-item-title">PWA Application</div>
              <div className="settings-item-desc">Install SLBW on your home screen or desktop for offline access</div>
            </div>
          </div>
          <Button
            variant={isStandalone ? "outline" : "default"}
            size="sm"
            disabled={isStandalone}
            onClick={installPwa}
          >
            {isStandalone ? 'Installed' : 'Install App'}
          </Button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-icon-box">
              <Bell className="size-4 text-foreground"/>
            </div>
            <div>
              <div className="settings-item-title">Push Notifications</div>
              <div className="settings-item-desc">Receive real-time order and operational updates on this device</div>
            </div>
          </div>
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            aria-pressed={enabled}
            disabled={busy}
            onClick={toggle}
          >
            {busy ? 'Please wait…' : enabled ? 'Enabled' : 'Enable'}
          </Button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-icon-box">
              <UserRound className="size-4 text-foreground"/>
            </div>
            <div>
              <div className="settings-item-title">Account Session</div>
              <div className="settings-item-desc">
                {user ? (user.email || 'Logged in') : 'You are currently not signed in'}
              </div>
            </div>
          </div>
          {user ? (
            <Button
              variant="outline"
              size="sm"
              onClick={()=>supabase.auth.signOut()}
            >
              <LogOut className="size-3.5 mr-1.5"/>
              <span>Sign out</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="settings-card settings-card-danger">
        <div className="settings-item">
          <div className="settings-item-info">
            <div className="settings-icon-box settings-icon-danger">
              <Trash2 className="size-4"/>
            </div>
            <div>
              <div className="settings-item-title text-red-400">Delete Account</div>
              <div className="settings-item-desc">Permanently remove your account and all associated preferences</div>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={remove}
            disabled={!user}
          >
            <Trash2 className="size-3 mr-1.5"/>
            <span>Delete account</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Profile(){
  const {user,signIn}=useFactory();
  const [busy,setBusy]=useState(false);

  async function save(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setBusy(true);
    const f=new FormData(e.currentTarget);
    const displayName=String(f.get('name')??'');
    const role=String(f.get('role')??'');
    const phone=String(f.get('phone')??'');

    const {error}=await supabase.auth.updateUser({
      data:{
        display_name:displayName,
        role:role,
        phone:phone,
      }
    });

    setBusy(false);
    if(error){
      toast.error(error.message);
    } else {
      toast.success('Profile details saved successfully');
    }
  }

  if(!user){
    return (
      <div className="settings-page">
        <Heading title="Account Profile"/>
        <div className="p-8 border border-border rounded-xl bg-card text-center space-y-4 max-w-md mx-auto my-12">
          <div className="w-14 h-14 rounded-full bg-secondary grid place-items-center mx-auto text-primary">
            <UserRound size={26}/>
          </div>
          <div>
            <h2 className="text-lg font-medium">Authentication Required</h2>
            <p className="text-xs text-muted-foreground mt-1">Sign in or create an account to view and customize your factory profile.</p>
          </div>
          <Link to="/login" className="block w-full">
            <Button className="w-full rounded-full shadow-none" style={{ boxShadow: 'none' }}>Sign in to SLBW</Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials=(user.user_metadata['display_name']||user.email||'U').slice(0,2).toUpperCase();

  return (
    <div className="settings-page">
      <Heading title="Account Profile"/>

      {/* User Identity Banner (CRM Style) */}
      <div className="p-6 bg-card border border-border rounded-xl mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground font-semibold text-xl grid place-items-center flex-shrink-0">
          {initials}
        </div>
        <div>
          <h2 className="text-lg font-medium leading-tight">
            {user.user_metadata['display_name'] || 'Team Member'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="pill">{user.user_metadata['role'] || 'Workspace Member'}</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-success"/> Authenticated Account
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={save} className="p-6 bg-card border border-border rounded-xl space-y-5">
        <div className="form-section-title !mt-0">Profile Information</div>
        <div className="form-grid">
          <label>
            Full Name / Display Name
            <input
              name="name"
              defaultValue={user.user_metadata['display_name'] ?? ''}
              placeholder="e.g. Jensen Ackles"
              required
            />
          </label>

          <label>
            Job Title / Role
            <input
              name="role"
              defaultValue={user.user_metadata['role'] ?? ''}
              placeholder="e.g. Account Executive, Plant Manager"
            />
          </label>

          <label>
            Contact Phone
            <input
              name="phone"
              defaultValue={user.user_metadata['phone'] ?? ''}
              placeholder="e.g. +91 98765 43210"
            />
          </label>

          <label>
            Registered Email
            <input readOnly value={user.email ?? ''} className="opacity-70 cursor-not-allowed"/>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button disabled={busy} type="submit">
            {busy ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function Admin(){
  const {data:d,user,isAdmin,handoverRole,revokeRole,refresh}=useFactory();
  const [users,setUsers]=useState<AdminUserRecord[]>([]);
  const [loading,setLoading]=useState(false);
  const [search,setSearch]=useState('');
  const [filterRole,setFilterRole]=useState<string>('All');
  const [handoverModalOpen,setHandoverModalOpen]=useState(false);
  const [targetUser,setTargetUser]=useState<AdminUserRecord|null>(null);
  const [targetIdOrEmail,setTargetIdOrEmail]=useState('');
  const [selectedRole,setSelectedRole]=useState<import('./provider').AppRole>('supervisor');
  const [busy,setBusy]=useState(false);
  const [page,setPage]=useState(1);
  const pageSize=10;

  // Load server auth users
  const loadUsers=async()=>{
    if(!isAdmin)return;
    setLoading(true);
    try{
      const {adminListUsers}=await import('@/lib/admin.functions');
      const res=await adminListUsers({});
      if(res.success&&res.users.length){
        setUsers(res.users);
      }
    }catch(err){
      console.warn('Could not load server users list:',err);
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    loadUsers();
  },[isAdmin]);

  // Merge server users with roles from data.roles
  const allUsersMap=new Map<string, AdminUserRecord>();

  // Add server users
  for(const u of users){
    allUsersMap.set(u.id,u);
  }

  // Add any users from d.roles that might not be in auth list
  for(const r of d.roles){
    if(!allUsersMap.has(r.user_id)){
      allUsersMap.set(r.user_id,{
        id:r.user_id,
        email:r.user_id===user?.id?user.email||'Current Admin':'member@slbw.local',
        created_at:new Date().toISOString(),
        role:(r.role as import('./provider').AppRole) || 'pending',
        display_name:r.user_id===user?.id?'You (Admin)':'Team Member'
      });
    } else {
      const existing=allUsersMap.get(r.user_id)!;
      existing.role=(r.role as import('./provider').AppRole) || 'pending';
    }
  }

  // Ensure current user is present
  if(user&&!allUsersMap.has(user.id)){
    allUsersMap.set(user.id,{
      id:user.id,
      email:user.email||'admin@slbw.local',
      created_at:user.created_at,
      role:isAdmin?'admin':'viewer',
      display_name:user.user_metadata?.['display_name']||'You'
    });
  }

  const userList=Array.from(allUsersMap.values());

  const filteredUsers=userList.filter(u=>{
    const matchesSearch=(u.email+' '+u.id+' '+(u.display_name||'')).toLowerCase().includes(search.toLowerCase());
    const matchesRole=filterRole==='All'||u.role===filterRole;
    return matchesSearch&&matchesRole;
  });

  useEffect(()=>{
    setPage(1);
  },[search,filterRole]);

  const paginatedUsers=filteredUsers.slice((page-1)*pageSize,page*pageSize);

  const pendingCount=userList.filter(u=>u.role==='pending').length;
  const adminCount=userList.filter(u=>u.role==='admin').length;
  const userCount=userList.filter(u=>u.role!=='pending'&&u.role!=='admin').length;

  const handleOpenHandover=(record?:AdminUserRecord)=>{
    if(record){
      setTargetUser(record);
      setTargetIdOrEmail(record.email||record.id);
      setSelectedRole(record.role==='pending'?'supervisor':record.role);
    } else {
      setTargetUser(null);
      setTargetIdOrEmail('');
      setSelectedRole('supervisor');
    }
    setHandoverModalOpen(true);
  };

  const handleExecuteHandover=async(e:FormEvent)=>{
    e.preventDefault();
    setBusy(true);
    const idToUse=targetUser?.id||targetIdOrEmail.trim();
    if(!idToUse){
      toast.error('Please enter a user ID or select a user');
      setBusy(false);
      return;
    }

    const ok=await handoverRole(idToUse,selectedRole);
    setBusy(false);
    if(ok){
      setHandoverModalOpen(false);
      setTargetUser(null);
      setTargetIdOrEmail('');
      await loadUsers();
    }
  };

  const handleQuickHandover=async(record:AdminUserRecord,role:'admin'|'user')=>{
    const ok=await handoverRole(record.id,role);
    if(ok)await loadUsers();
  };

  const handleRevoke=async(record:AdminUserRecord)=>{
    if(!window.confirm(`Revoke role from ${record.email}? They will be sent to the Pending Verification page.`))return;
    const ok=await revokeRole(record.id);
    if(ok)await loadUsers();
  };

  if(!isAdmin){
    return (
      <div className="settings-page">
        <Heading title="Admin & Role Handover"/>
        <AccessNotice/>
        <div className="p-8 border border-border rounded-xl bg-card text-center space-y-4 max-w-md mx-auto my-12">
          <div className="w-12 h-12 rounded-full bg-secondary grid place-items-center mx-auto text-primary">
            <ShieldCheck size={24}/>
          </div>
          <div>
            <h2 className="text-lg font-medium">Administrator Privileges Required</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Only authorized factory administrators can govern workspace access and handover roles to newly registered users.
            </p>
          </div>
          <Link to="/" className="block w-full">
            <Button variant="outline" className="w-full rounded-full shadow-none" style={{boxShadow:'none'}}>
              Return to Workspace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <Heading title="Admin & Role Handover">
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={loadUsers}
          className="rounded-full shadow-none"
          style={{boxShadow:'none'}}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading?'animate-spin':''}`}/>
          Refresh Users
        </Button>
        <Button
          size="sm"
          onClick={()=>handleOpenHandover()}
          className="rounded-full shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
          style={{boxShadow:'none'}}
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5"/>
          Handover Role
        </Button>
      </Heading>

      <AccessNotice/>

      {/* Role Distribution Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="metric !p-4 !mb-0">
          <div className="metric-top">
            <span>Administrators</span>
            <ShieldCheck className="w-4 h-4 text-primary"/>
          </div>
          <div className="metric-value !text-2xl !my-1.5">{adminCount}</div>
          <div className="metric-footer">Full management authority</div>
        </div>

        <div className="metric !p-4 !mb-0">
          <div className="metric-top">
            <span>Workspace Users</span>
            <UserCheck className="w-4 h-4 text-success"/>
          </div>
          <div className="metric-value !text-2xl !my-1.5">{userCount}</div>
          <div className="metric-footer">Active operational access</div>
        </div>

        <div className={`metric !p-4 !mb-0 ${pendingCount>0?'border-amber-500/40 bg-amber-500/5':''}`}>
          <div className="metric-top">
            <span className={pendingCount>0?'text-amber-500 font-medium':''}>Pending Verification</span>
            <Clock className={`w-4 h-4 ${pendingCount>0?'text-amber-500':'text-muted-foreground'}`}/>
          </div>
          <div className={`metric-value !text-2xl !my-1.5 ${pendingCount>0?'text-amber-500 font-semibold':''}`}>
            {pendingCount}
          </div>
          <div className="metric-footer">Newly signed up users awaiting handover</div>
        </div>
      </div>

      {/* Tab Filter Pills */}
      <div className="crm-tabs" role="tablist">
        {[
          {id:'All',label:'All Accounts',count:userList.length},
          {id:'pending',label:'Pending',count:pendingCount},
          {id:'admin',label:'Admin',count:adminCount},
          {id:'manager',label:'Manager',count:userList.filter(u=>u.role==='manager').length},
          {id:'supervisor',label:'Supervisor',count:userList.filter(u=>u.role==='supervisor').length},
          {id:'accountant',label:'Accountant',count:userList.filter(u=>u.role==='accountant').length},
          {id:'dispatch_clerk',label:'Dispatch',count:userList.filter(u=>u.role==='dispatch_clerk').length},
          {id:'viewer',label:'Viewer',count:userList.filter(u=>u.role==='viewer').length},
        ].map(t=>(
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filterRole===t.id}
            className={`crm-tab ${filterRole===t.id?'active':''}`}
            onClick={()=>setFilterRole(t.id)}
          >
            <span>{t.label}</span>
            <span className="crm-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <SearchFilter
          value={search}
          onChange={setSearch}
          placeholder="Search by email, name or user ID…"
        />
      </div>

      {/* Desktop Table View */}
      <div className="desktop-table-view table-wrap">
        <table>
          <thead>
            <tr>
              <th>Account / User</th>
              <th>User ID</th>
              <th>Assigned Role</th>
              <th>Status</th>
              <th className="text-right">Role Handover Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length ? paginatedUsers.map(u=>{
              const isCurrentUser=u.id===user?.id;
              const isPending=u.role==='pending';
              const monogram=(u.display_name||u.email).slice(0,2).toUpperCase();
              return (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span className="avatar !w-7 !h-7 !text-[10px] font-semibold flex-shrink-0">
                        {monogram}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <span>{u.display_name || u.email.split('@')[0]}</span>
                          {isCurrentUser && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">You</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {u.id.slice(0,8)}…{u.id.slice(-4)}
                  </td>
                  <td>
                    {u.role==='admin' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        <ShieldCheck className="w-3 h-3"/> Administrator
                      </span>
                    ) : u.role==='manager' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <ShieldCheck className="w-3 h-3"/> Manager
                      </span>
                    ) : u.role==='supervisor' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <UserCheck className="w-3 h-3"/> Supervisor
                      </span>
                    ) : u.role==='accountant' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <UserCheck className="w-3 h-3"/> Accountant
                      </span>
                    ) : u.role==='dispatch_clerk' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <UserCheck className="w-3 h-3"/> Dispatch Clerk
                      </span>
                    ) : u.role==='viewer' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground border border-border">
                        <UserCheck className="w-3 h-3"/> Viewer
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30">
                        <Clock className="w-3 h-3"/> Pending Verification
                      </span>
                    )}
                  </td>
                  <td>
                    {isPending ? (
                      <span className="text-xs text-amber-500 font-medium">Awaiting Handover</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Verified & Active</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full shadow-none text-xs h-7 px-3 bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                            style={{boxShadow:'none'}}
                            onClick={()=>handleQuickHandover(u,'user')}
                          >
                            <UserCheck className="w-3 h-3 mr-1"/> Handover User Role
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full shadow-none text-xs h-7 px-3"
                            style={{boxShadow:'none'}}
                            onClick={()=>handleQuickHandover(u,'admin')}
                          >
                            Make Admin
                          </Button>
                        </>
                      ) : isCurrentUser ? (
                        <span className="text-xs text-muted-foreground italic pr-2">Current Active Admin</span>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full shadow-none text-xs h-7 px-3"
                            style={{boxShadow:'none'}}
                            onClick={()=>handleQuickHandover(u,u.role==='admin'?'user':'admin')}
                          >
                            <ArrowRightLeft className="w-3 h-3 mr-1"/>
                            {u.role==='admin'?'Switch to User':'Promote Admin'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full shadow-none text-xs h-7 px-2.5 text-destructive hover:bg-destructive/10"
                            style={{boxShadow:'none'}}
                            onClick={()=>handleRevoke(u)}
                            title="Revoke access and set back to pending verification"
                          >
                            <UserX className="w-3 h-3"/>
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <Empty columns={5} label="No matching user accounts discovered"/>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="mobile-card-view">
        {paginatedUsers.length ? paginatedUsers.map(u=>{
          const isCurrentUser=u.id===user?.id;
          const isPending=u.role==='pending';
          const monogram=(u.display_name||u.email).slice(0,2).toUpperCase();
          return (
            <div key={u.id} className="mobile-record-card">
              <div className="mobile-card-top">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="avatar !w-7 !h-7 !text-[10px] font-semibold flex-shrink-0">
                    {monogram}
                  </span>
                  <div className="min-w-0">
                    <div className="mobile-card-title flex items-center gap-1.5">
                      <span>{u.display_name||u.email.split('@')[0]}</span>
                      {isCurrentUser && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">You</span>
                      )}
                    </div>
                    <div className="mobile-card-sub truncate">{u.email}</div>
                  </div>
                </div>

                {u.role==='admin' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                    Admin
                  </span>
                ) : u.role==='user' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-secondary text-foreground border border-border">
                    User
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    Pending
                  </span>
                )}
              </div>

              <div className="mobile-card-grid">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">User ID</span>
                  <span className="mobile-card-value font-mono text-[11px]">
                    {u.id.slice(0,8)}…{u.id.slice(-4)}
                  </span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Verification Status</span>
                  <span className={`mobile-card-value ${isPending?'text-amber-500 font-medium':'text-muted-foreground'}`}>
                    {isPending?'Awaiting Handover':'Active & Approved'}
                  </span>
                </div>
              </div>

              <div className="mobile-card-actions pt-2">
                {isPending ? (
                  <div className="flex gap-2 w-full">
                    <Button
                      size="sm"
                      className="flex-1 rounded-full shadow-none text-xs bg-primary text-primary-foreground"
                      style={{boxShadow:'none'}}
                      onClick={()=>handleQuickHandover(u,'user')}
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1"/> Handover User Role
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full shadow-none text-xs"
                      style={{boxShadow:'none'}}
                      onClick={()=>handleQuickHandover(u,'admin')}
                    >
                      Make Admin
                    </Button>
                  </div>
                ) : isCurrentUser ? (
                  <span className="text-xs text-muted-foreground italic w-full text-center">Current Active Admin</span>
                ) : (
                  <div className="flex gap-2 w-full">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-full shadow-none text-xs"
                      style={{boxShadow:'none'}}
                      onClick={()=>handleQuickHandover(u,u.role==='admin'?'user':'admin')}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1"/>
                      {u.role==='admin'?'Switch to User':'Make Admin'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full shadow-none text-xs text-destructive"
                      style={{boxShadow:'none'}}
                      onClick={()=>handleRevoke(u)}
                    >
                      Revoke
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <Empty columns={1} label="No matching user accounts discovered"/>
        )}
      </div>

      <Pagination
        currentPage={page}
        totalItems={filteredUsers.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {/* Role Handover Modal */}
      <Dialog open={handoverModalOpen} onOpenChange={setHandoverModalOpen}>
        <DialogContent className="modal-wide !max-w-md" aria-describedby={undefined}>
          <DialogTitle className="text-lg font-medium">Handover Workspace Role</DialogTitle>
          <div className="form-subtitle">
            Assign an operational or administrator role to verify the newly signed up user.
          </div>

          <form onSubmit={handleExecuteHandover} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Target User (Email or User UUID)
              </label>
              <input
                required
                value={targetIdOrEmail}
                onChange={e=>setTargetIdOrEmail(e.target.value)}
                placeholder="e.g. jensen@factory.com or uuid"
                className="w-full h-10 px-4 rounded-full border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                style={{boxShadow:'none'}}
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Paste the user's registered email or User ID from their Pending Verification page.
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Role to Handover
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'admin', title: 'Administrator', desc: 'Full owner authority, user governance & financials.' },
                  { id: 'manager', title: 'Manager', desc: 'Operations & logistics management, cancel challans.' },
                  { id: 'supervisor', title: 'Supervisor', desc: 'Shop-floor labour assignment & completions.' },
                  { id: 'accountant', title: 'Accountant', desc: 'Invoicing, expenses, borrowings & payroll payments.' },
                  { id: 'dispatch_clerk', title: 'Dispatch Clerk', desc: 'Drafting & confirming delivery challans, LR entry.' },
                  { id: 'viewer', title: 'Viewer', desc: 'Read-only operational counts, zero money access.' },
                ].map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRole(r.id as import('./provider').AppRole)}
                    className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                      selectedRole === r.id
                        ? 'border-primary bg-primary/5 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground/40'
                    }`}
                    style={{boxShadow:'none'}}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">{r.title}</span>
                      {selectedRole === r.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary"/>}
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-snug">
                      {r.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                className="rounded-full shadow-none text-xs"
                style={{boxShadow:'none'}}
                onClick={()=>setHandoverModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy}
                className="rounded-full shadow-none text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                style={{boxShadow:'none'}}
              >
                {busy?'Saving…':'Confirm Role Handover'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
