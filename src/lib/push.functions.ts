import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const getPushKey=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async()=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 let {data}=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).maybeSingle();
 if(!data){const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const raw=await crypto.subtle.exportKey('raw',key.publicKey);const jwk=await crypto.subtle.exportKey('jwk',key.privateKey);if(!jwk.d)throw new Error('Unable to initialize notifications');const publicKey=btoa(String.fromCharCode(...new Uint8Array(raw))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');await supabaseAdmin.from('push_configuration').upsert({id:1,public_key:publicKey,private_key:jwk.d},{onConflict:'id',ignoreDuplicates:true});const result=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).single();if(result.error)throw result.error;data=result.data;}
 return {publicKey:data.public_key};
});
export const runFactoryAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((input:{action:string;payload:import('@/integrations/supabase/types').Json})=>input).handler(async({data,context})=>{
 const started=new Date().toISOString();
 const result=await context.supabase.rpc('factory_action',data);if(result.error)throw new Error(result.error.message);
 try {
 const {data:notifications}=await context.supabase.from('factory_notifications').select('*').gte('created_at',started);
 if(!notifications?.length)return result.data;
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:config}=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).maybeSingle();if(!config)return result.data;
 const {data:subscriptions}=await supabaseAdmin.from('push_subscriptions').select('*');const {buildPushPayload}=await import('@block65/webcrypto-web-push');
 for(const s of subscriptions??[]){const url=new URL(s.endpoint);if(url.protocol!=='https:'||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))continue;
 for(const n of notifications){const payload=await buildPushPayload({data:JSON.stringify({title:n.title,body:n.body,url:n.path,tag:n.id}),options:{ttl:3600}},{endpoint:s.endpoint,expirationTime:null,keys:{p256dh:s.p256dh,auth:s.auth}},{subject:'https://project--0f6f46f3-58a5-412c-94a4-61857eba9371.lovable.app',publicKey:config.public_key,privateKey:config.private_key});const response=await fetch(s.endpoint,payload);if(response.status===404||response.status===410)await supabaseAdmin.from('push_subscriptions').delete().eq('id',s.id);else if(!response.ok)console.error('Push delivery failed',response.status);}}
 }catch(error){console.error('Factory notification delivery failed',error);}
 return result.data;
});
export const deleteMyAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {supabaseAdmin}=await import('@/integrations/supabase/client.server');await context.supabase.from('push_subscriptions').delete().eq('user_id',context.userId);const {error}=await supabaseAdmin.auth.admin.deleteUser(context.userId);if(error)throw error;return {success:true};});
