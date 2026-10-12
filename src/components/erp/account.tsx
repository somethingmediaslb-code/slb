import {useEffect,useState} from 'react';
import {Bell,Trash2,LogOut,ShieldCheck,UserRound,Mail,Phone,Briefcase,CheckCircle2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useFactory} from './provider';
import {Heading,AccessNotice} from './common';
import {supabase} from '@/integrations/supabase/client';
import {enablePush,disablePush} from '@/lib/push';
import {deleteMyAccount} from '@/lib/push.functions';
import {toast} from 'sonner';

export function Settings(){
  const {user,signIn}=useFactory();
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    navigator.serviceWorker?.getRegistration('/messaging-sw.js').then(r=>r?.pushManager.getSubscription()).then(s=>setEnabled(!!s));
  },[]);

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
    <div className="settings-page">
      <Heading title="Settings"/>
      <AccessNotice/>
      <div className="settings-row">
        <h2 className="flex gap-3 items-center"><Bell size={20}/>Push notifications</h2>
        <Button variant={enabled?'default':'outline'} aria-pressed={enabled} disabled={busy} onClick={toggle}>
          {busy?'Please wait…':enabled?'Enabled':'Enable notifications'}
        </Button>
      </div>
      <div className="settings-row">
        <h2>Account</h2>
        <Button variant="outline" onClick={()=>supabase.auth.signOut()} disabled={!user}>
          <LogOut className="w-4 h-4 mr-1.5"/> Sign out
        </Button>
      </div>
      <div className="settings-row">
        <h2>Delete account</h2>
        <Button variant="destructive" onClick={remove}>
          <Trash2 className="w-4 h-4 mr-1.5"/> Delete account
        </Button>
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
          <Button onClick={signIn} className="w-full">Sign in to CrateERP</Button>
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
  const {data:d,user}=useFactory();
  const admin=d.roles.some(r=>r.role==='admin'&&r.user_id===user?.id);
  return (
    <>
      <Heading title="Admin Panel"/>
      <AccessNotice/>
      <div className="settings-row">
        <h2 className="flex items-center gap-3"><ShieldCheck size={20}/>Factory access</h2>
        <span>{admin?'Administrator':'No administrator access'}</span>
      </div>
    </>
  );
}
