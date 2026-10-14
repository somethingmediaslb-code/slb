import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function handleTentativeCompletionsCron(request: Request, env: any): Promise<Response> {
  const secret = process.env.CRON_SECRET || env?.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || !provided || !constantTimeEqual(secret, provided)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const { data: allocations, error } = await supabaseAdmin
      .from("production_allocations")
      .select("*")
      .lte("tentative_completion", nowIso)
      .is("completion_alert_sent_at", null);

    if (error) throw error;

    const overdue = (allocations ?? []).filter((a: any) => a.completed_qty < a.allocated_qty);
    if (!overdue.length) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const { data: config } = await supabaseAdmin.from("push_configuration").select("*").eq("id", 1).maybeSingle();
    const { data: approvedRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager", "supervisor"]);
    const approvedIds = new Set((approvedRoles ?? []).map((r: any) => r.user_id));
    const { data: allSubs } = await supabaseAdmin.from("push_subscriptions").select("*");
    const subscriptions = (allSubs ?? []).filter((s: any) => approvedIds.has(s.user_id));

    const { buildPushPayload } = await import("@block65/webcrypto-web-push");

    let count = 0;
    for (const alloc of overdue) {
      // 1. Mark alert as sent immediately so it cannot alert twice
      await supabaseAdmin
        .from("production_allocations")
        .update({ completion_alert_sent_at: nowIso } as any)
        .eq("id", alloc.id);

      // 2. Insert notification
      const remaining = alloc.allocated_qty - alloc.completed_qty;
      const { data: notif } = await supabaseAdmin
        .from("factory_notifications")
        .insert({
          title: "⏰ Tentative Completion Time Reached",
          body: `An allocation for ${alloc.allocated_qty} boxes has reached tentative time with ${remaining} pending pieces.`,
          path: `/labour?allocation=${alloc.id}`,
        })
        .select()
        .single();

      // 3. Dispatch web push if configured
      if (config && subscriptions.length && notif) {
        for (const s of subscriptions) {
          const url = new URL(s.endpoint);
          if (
            url.protocol !== "https:" ||
            !["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].some(
              (host) => url.hostname === host || url.hostname.endsWith("." + host),
            )
          )
            continue;

          try {
            const payload = await buildPushPayload(
              {
                data: JSON.stringify({
                  title: notif.title,
                  body: notif.body,
                  url: notif.path,
                  tag: notif.id,
                }),
                options: { ttl: 3600 },
              },
              { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
              {
                subject: process.env["APP_URL"] || "mailto:admin@slbw.local",
                publicKey: config.public_key,
                privateKey: config.private_key,
              },
            );
            await fetch(s.endpoint, payload);
          } catch (pushErr) {
            console.error("Cron push send failed:", pushErr);
          }
        }
      }
      count++;
    }

    return new Response(JSON.stringify({ success: true, processed: count }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Tentative completion cron failed:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal Error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/cron/check-tentative-completions") {
        return await handleTentativeCompletionsCron(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
