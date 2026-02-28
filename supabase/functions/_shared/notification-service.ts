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
      return { ok: true, provider: "onesignal", notificationId: null, recipientsCount: 0 };
    }

    return this.sendToDeviceIds(ids, title, message, data);
  }

  async sendToDeviceIds(onesignalIds: string[], title: string, message: string, data: Record<string, unknown> = {}) {
    const uniqueIds = [...new Set(onesignalIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { ok: true, provider: "onesignal", notificationId: null, recipientsCount: 0 };
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

    return {
      ok: true,
      provider: "onesignal",
      notificationId: body.id ?? null,
      recipientsCount: body.recipients ?? 0,
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
