export interface PushErrorDetails {
  message: string;
  friendlyMessage: string;
  hint?: string;
  errorType?: string;
  technicalMessage?: string;
}

function getRawErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "erro desconhecido");
}

export function getPushErrorMessage(error: unknown): string {
  const details = getPushErrorDetails(error);
  return details.friendlyMessage;
}

export function getPushErrorDetails(error: unknown): PushErrorDetails {
  const raw = getRawErrorMessage(error);

  if (raw.includes("Failed to send a request to the Edge Function")) {
    return {
      message: "Falha de conexão com a Edge Function.",
      friendlyMessage: "Não foi possível conectar ao serviço de notificações. Verifique sua conexão e se as Edge Functions foram implantadas.",
      hint: "Confirme o deploy das funções notifications-test e notifications-register-device no Supabase e valide VITE_SUPABASE_URL.",
      errorType: "edge_function_unreachable",
      technicalMessage: raw,
    };
  }

  if (raw.includes("FunctionsFetchError")) {
    return {
      message: "Erro de comunicação com o backend de notificações.",
      friendlyMessage: "Falha de comunicação com o backend de notificações.",
      hint: "Verifique conectividade de rede e disponibilidade das Edge Functions.",
      errorType: "functions_fetch_error",
      technicalMessage: raw,
    };
  }

  return {
    message: "Erro inesperado ao enviar push.",
    friendlyMessage: `Erro ao enviar push: ${raw}`,
    errorType: "unknown",
    technicalMessage: raw,
  };
}
