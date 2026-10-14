import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const getPushKey=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async()=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 let {data}=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).maybeSingle();
 if(!data){const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const raw=await crypto.subtle.exportKey('raw',key.publicKey);const jwk=await crypto.subtle.exportKey('jwk',key.privateKey);if(!jwk.d)throw new Error('Unable to initialize notifications');const publicKey=btoa(String.fromCharCode(...new Uint8Array(raw))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');await supabaseAdmin.from('push_configuration').upsert({id:1,public_key:publicKey,private_key:jwk.d},{onConflict:'id',ignoreDuplicates:true});const result=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).single();if(result.error)throw result.error;data=result.data;}
 return {publicKey:data.public_key};
});
export const runFactoryAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).validator((input:{action:string;payload:import('@/integrations/supabase/types').Json})=>input).handler(async({data,context})=>{
 const started=new Date().toISOString();
 const result=await context.supabase.rpc('factory_action',data);if(result.error)throw new Error(result.error.message);
 try {
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  // 1. Ensure pending users cannot trigger pushes
  const {data:callerRole}=await supabaseAdmin.from('user_roles').select('role').eq('user_id',context.userId).maybeSingle();
  if(!callerRole || callerRole.role === 'pending' || callerRole.role === 'viewer') return result.data;

  const payload = data.payload as any;
  const entityId = (result.data as any)?.id;

  // 2. Dedupe by entity ID (order / challan / allocation id) - No prices in notification text
  if (data.action === 'order' && payload?.items?.some((i: any) => i?.priority_signal === 'Red') && entityId) {
    const dedupeTag = `/production?order=${entityId}`;
    const {data:existing}=await supabaseAdmin.from('factory_notifications').select('id').eq('path',dedupeTag).limit(1);
    if (!existing?.length) {
      await context.supabase.from('factory_notifications').insert({
        title: '🚨 Urgent Red Priority Order',
        body: 'A new high-priority order was received and requires immediate production allocation.',
        path: dedupeTag
      });
    }
  } else if (data.action === 'dispatch' && entityId) {
    const dedupeTag = `/dispatch?challan=${entityId}`;
    const {data:existing}=await supabaseAdmin.from('factory_notifications').select('id').eq('path',dedupeTag).limit(1);
    if (!existing?.length) {
      await context.supabase.from('factory_notifications').insert({
        title: '🚚 Delivery Challan Dispatched',
        body: 'A delivery challan was confirmed and dispatched for shipping.',
        path: dedupeTag
      });
    }
  } else if (data.action === 'complete' && entityId) {
    const { data: allocRow } = await supabaseAdmin
      .from('production_allocations')
      .select('id, allocated_qty, completed_qty')
      .eq('id', entityId)
      .maybeSingle();

    if (allocRow && allocRow.completed_qty >= allocRow.allocated_qty) {
      const dedupeKey = `${allocRow.id}completed`;
      const dedupeTag = `/labour?allocation=${allocRow.id}#${dedupeKey}`;
      const { data: existing } = await supabaseAdmin
        .from('factory_notifications')
        .select('id')
        .eq('path', dedupeTag)
        .limit(1);

      if (!existing?.length) {
        await context.supabase.from('factory_notifications').insert({
          title: '✅ Labour Allocation Completed',
          body: 'A production allocation batch was fully completed.',
          path: dedupeTag
        });
      }
    }
  }

  const {data:notifications}=await context.supabase.from('factory_notifications').select('*').gte('created_at',started);
  if(!notifications?.length)return result.data;

  const {data:config}=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).maybeSingle();
  if(!config)return result.data;

  // 3. Recipient role targeting per business rules:
  // - Red-priority order -> admin, manager, supervisor
  // - Challan dispatched -> admin, manager, accountant, dispatch_clerk
  // - Allocation completed -> admin, manager, supervisor
  let targetRoles: string[] = ['admin', 'manager'];
  if (data.action === 'order') {
    targetRoles = ['admin', 'manager', 'supervisor'];
  } else if (data.action === 'dispatch') {
    targetRoles = ['admin', 'manager', 'accountant', 'dispatch_clerk'];
  } else if (data.action === 'complete') {
    targetRoles = ['admin', 'manager', 'supervisor'];
  }

  const {data:approvedRoles}=await supabaseAdmin.from('user_roles').select('user_id').in('role', targetRoles);
  const approvedIds=new Set((approvedRoles??[]).map(r=>r.user_id));
  const {data:allSubs}=await supabaseAdmin.from('push_subscriptions').select('*');
  const subscriptions=(allSubs??[]).filter(s=>approvedIds.has(s.user_id));

  const {buildPushPayload}=await import('@block65/webcrypto-web-push');
  for(const s of subscriptions){
    const url=new URL(s.endpoint);
    if(url.protocol!=='https:'||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))continue;
    for(const n of notifications){
      const payload=await buildPushPayload({data:JSON.stringify({title:n.title,body:n.body,url:n.path,tag:n.id}),options:{ttl:3600}},{endpoint:s.endpoint,expirationTime:null,keys:{p256dh:s.p256dh,auth:s.auth}},{subject:process.env['APP_URL']||'mailto:admin@slbw.local',publicKey:config.public_key,privateKey:config.private_key});
      const response=await fetch(s.endpoint,payload);
      if(response.status===404||response.status===410)await supabaseAdmin.from('push_subscriptions').delete().eq('id',s.id);
      else if(!response.ok)console.error('Push delivery failed',response.status);
    }
  }
 }catch(error){console.error('Factory notification delivery failed',error);}
 return result.data;
});
export const deleteMyAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {supabaseAdmin}=await import('@/integrations/supabase/client.server');await context.supabase.from('push_subscriptions').delete().eq('user_id',context.userId);const {error}=await supabaseAdmin.auth.admin.deleteUser(context.userId);if(error)throw error;return {success:true};});
