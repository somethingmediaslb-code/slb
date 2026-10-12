import { supabase } from "@/integrations/supabase/client";
import { enablePush } from "@/lib/push";

const VAPID_PUBLIC_KEY = (import.meta.env as Record<string, string | undefined>)['VITE_VAPID_PUBLIC_KEY'] || '';

export async function registerPWAAndSubscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported on this device.');
    return;
  }

  try {
    // If VAPID key is configured through backend edge function, enablePush handles it cleanly
    await enablePush();
  } catch (error) {
    console.error('PWA Push registration failed:', error);
  }
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
