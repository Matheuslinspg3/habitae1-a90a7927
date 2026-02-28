export function getPushErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "erro desconhecido");

  if (raw.includes("Failed to send a request to the Edge Function")) {
    return "Não foi possível conectar ao serviço de notificações. Verifique sua conexão e se as Edge Functions foram implantadas.";
  }

  if (raw.includes("FunctionsFetchError")) {
    return "Falha de comunicação com o backend de notificações.";
  }

  return `Erro ao enviar push: ${raw}`;
}
