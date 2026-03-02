import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./logger.ts";

interface RegisterDeviceParams {
  userId: string;
  onesignalId: string;
  platform: string;
  metadata?: Record<string, unknown>;
}

interface SendParams {
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface OneSignalResponse {
  id?: string;
  recipients?: number;
  errors?: unknown;
  [key: string]: unknown;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function extractInvalidSubscriptionIds(errors: unknown): string[] {
  if (!errors || typeof errors !== "object") return [];

  const err = errors as Record<string, unknown>;
  const candidates = [
    err.invalid_player_ids,
    err.invalid_subscription_ids,
    err.invalid_receiver_ids,
    err.invalid_external_user_ids,
  ];

  const invalidFromKnown = candidates.flatMap(toStringArray);

  const invalidAliases = err.invalid_aliases;
  const invalidFromAliases =
    invalidAliases && typeof invalidAliases === "object"
      ? Object.values(invalidAliases as Record<string, unknown>).flatMap(toStringArray)
      : [];

  return [...new Set([...invalidFromKnown, ...invalidFromAliases])];
}

function hasOneSignalErrors(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors as Record<string, unknown>).length > 0;
  return true;
}

export class NotificationService {
  private readonly appId: string;
  private readonly restApiKey: string;
  private readonly supabase;
  private readonly log;

  constructor(req?: Request) {
    this.log = createLogger("notification-service", req);
    this.appId = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
    this.restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";

    if (!this.appId || !this.restApiKey) {
      throw new Error("OneSignal is not configured. Please set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRole) {
      throw new Error("Supabase service credentials not configured");
    }

    this.supabase = createClient(supabaseUrl, serviceRole);
  }

  async registerDevice(params: RegisterDeviceParams) {
    const { userId, onesignalId, platform, metadata = {} } = params;

    // If the same browser/device (same OneSignal subscription id) changed account,
    // remove stale links from previous users before upserting the current user.
    const { error: detachError } = await this.supabase
      .from("user_devices")
      .delete()
      .eq("onesignal_id", onesignalId)
      .neq("user_id", userId);

    if (detachError) {
      this.log.warn("Failed to detach OneSignal ID from previous users", {
        user_id: userId,
        onesignal_id: onesignalId,
        code: detachError.code,
      });
    }

    const { error } = await this.supabase
      .from("user_devices")
      .upsert(
        {
          user_id: userId,
          onesignal_id: onesignalId,
          platform,
          metadata,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,onesignal_id" },
      );

    if (error) {
      this.log.error("Failed to register device", { user_id: userId, platform, code: error.code });
      throw new Error(`Failed to register device: ${error.message}`);
    }

    this.log.info("Device registered", { user_id: userId, platform });
    return { ok: true };
  }

  async unregisterDevice(userId: string, onesignalId: string) {
    const { error } = await this.supabase
      .from("user_devices")
      .delete()
      .eq("user_id", userId)
      .eq("onesignal_id", onesignalId);

    if (error) {
      this.log.error("Failed to unregister device", { user_id: userId, code: error.code });
      throw new Error(`Failed to unregister device: ${error.message}`);
    }

    return { ok: true };
  }

  async sendToUser(userId: string, title: string, message: string, data: Record<string, unknown> = {}) {
    const { data: rows, error } = await this.supabase
      .from("user_devices")
      .select("onesignal_id")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to resolve user devices: ${error.message}`);
    }

    const ids = (rows || []).map((r: { onesignal_id: string }) => r.onesignal_id).filter(Boolean);
    if (ids.length === 0) {
      return {
        ok: true,
        provider: "onesignal",
        notificationId: null,
        recipientsCount: 0,
        reason: "no_registered_devices",
        resolvedDeviceCount: 0,
      };
    }

    const result = await this.sendToDeviceIds(ids, title, message, data);
    return {
      ...result,
      resolvedDeviceCount: ids.length,
    };
  }

  async sendToDeviceIds(onesignalIds: string[], title: string, message: string, data: Record<string, unknown> = {}) {
    const uniqueIds = [...new Set(onesignalIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return {
        ok: true,
        provider: "onesignal",
        notificationId: null,
        recipientsCount: 0,
        reason: "no_subscription_ids",
      };
    }

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Authorization": `Key ${this.restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: this.appId,
        include_subscription_ids: uniqueIds,
        target_channel: "push",
        headings: { en: title },
        contents: { en: message || title },
        data,
      }),
    });

    const body = await response.json() as OneSignalResponse;
    if (!response.ok) {
      this.log.error("OneSignal request failed", { status: response.status, response: body });
      return {
        ok: false,
        provider: "onesignal",
        errorMessage: "Falha no envio via OneSignal",
        errorDetails: body,
      };
    }

    const recipientsCount = Number(body.recipients ?? 0);
    const invalidIds = extractInvalidSubscriptionIds(body.errors);
    const providerHasErrors = hasOneSignalErrors(body.errors);

    if (invalidIds.length > 0) {
      const { error: cleanupError } = await this.supabase
        .from("user_devices")
        .delete()
        .in("onesignal_id", invalidIds);

      if (cleanupError) {
        this.log.warn("Failed to cleanup invalid OneSignal IDs", {
          code: cleanupError.code,
          invalid_ids_count: invalidIds.length,
        });
      } else {
        this.log.info("Invalid OneSignal IDs cleaned up", { invalid_ids_count: invalidIds.length });
      }
    }

    let reason: string | null = null;
    if (recipientsCount === 0) {
      if (invalidIds.length > 0) {
        reason = "invalid_subscriptions";
      } else if (providerHasErrors) {
        reason = "provider_errors";
      } else {
        reason = "no_deliverable_subscriptions";
      }
    }

    return {
      ok: true,
      provider: "onesignal",
      notificationId: body.id ?? null,
      recipientsCount,
      reason,
      attemptedIds: uniqueIds.length,
      invalidIdsRemoved: invalidIds.length,
      raw: body,
    };
  }

  async sendTest(target: { userId?: string; onesignalIds?: string[] }, params: SendParams) {
    const { title, message, data = {} } = params;

    if (target.userId) {
      return this.sendToUser(target.userId, title, message, data);
    }

    return this.sendToDeviceIds(target.onesignalIds || [], title, message, data);
  }
}
