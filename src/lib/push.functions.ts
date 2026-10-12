import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const getPushKey=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async()=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 let {data}=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).maybeSingle();
 if(!data){const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const raw=await crypto.subtle.exportKey('raw',key.publicKey);const jwk=await crypto.subtle.exportKey('jwk',key.privateKey);if(!jwk.d)throw new Error('Unable to initialize notifications');const publicKey=btoa(String.fromCharCode(...new Uint8Array(raw))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');await supabaseAdmin.from('push_configuration').upsert({id:1,public_key:publicKey,private_key:jwk.d},{onConflict:'id',ignoreDuplicates:true});const result=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).single();if(result.error)throw result.error;data=result.data;}
 return {publicKey:data.public_key};
});
export const deliverFactoryNotifications=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:notifications,error}=await context.supabase.from('factory_notifications').select('*').order('created_at',{ascending:false}).limit(5);if(error)throw error;
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:config}=await supabaseAdmin.from('push_configuration').select('*').eq('id',1).maybeSingle();if(!config)return {sent:0};
 const {data:subscriptions}=await context.supabase.from('push_subscriptions').select('*');const {buildPushPayload}=await import('@block65/webcrypto-web-push');let sent=0;
 for(const s of subscriptions??[]){const url=new URL(s.endpoint);if(url.protocol!=='https:'||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))continue;const n=notifications?.[0];if(!n)continue;const payload=await buildPushPayload({data:JSON.stringify({title:n.title,body:n.body,url:n.path,tag:n.id}),options:{ttl:60}},{endpoint:s.endpoint,expirationTime:null,keys:{p256dh:s.p256dh,auth:s.auth}},{subject:'https://project--0f6f46f3-58a5-412c-94a4-61857eba9371.lovable.app',publicKey:config.public_key,privateKey:config.private_key});const response=await fetch(s.endpoint,payload);if(response.ok)sent++;else if(response.status===404||response.status===410)await context.supabase.from('push_subscriptions').delete().eq('id',s.id);else console.error('Push delivery failed',response.status);}
 return {sent};
});
export const deleteMyAccount=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {supabaseAdmin}=await import('@/integrations/supabase/client.server');await context.supabase.from('push_subscriptions').delete().eq('user_id',context.userId);const {error}=await supabaseAdmin.auth.admin.deleteUser(context.userId);if(error)throw error;return {success:true};});
