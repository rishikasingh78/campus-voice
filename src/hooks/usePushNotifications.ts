import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(userId: string | null) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vapidKey, setVapidKey] = useState<string>("");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      fetch(`${SUPABASE_URL}/functions/v1/get-vapid-key`, {
        headers: { "apikey": SUPABASE_ANON_KEY },
      })
        .then(res => res.json())
        .then(data => {
          if (data.vapid_public_key) {
            setVapidKey(data.vapid_public_key);
          }
        })
        .catch(err => console.warn("Could not fetch VAPID key:", err));
    }

    if (supported && userId) {
      checkSubscription();
    }
  }, [userId]);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (e) {
      console.error("Error checking push subscription:", e);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!userId || !vapidKey) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Notification permission denied");
        setLoading(false);
        return false;
      }

      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subscriptionJson = subscription.toJSON();

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh,
          auth: subscriptionJson.keys!.auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Error subscribing to push:", e);
      setLoading(false);
      return false;
    }
  }, [userId, vapidKey]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);
      }

      setIsSubscribed(false);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Error unsubscribing from push:", e);
      setLoading(false);
      return false;
    }
  }, [userId]);

  return { isSupported, isSubscribed, loading, subscribe, unsubscribe, vapidKey };
}
