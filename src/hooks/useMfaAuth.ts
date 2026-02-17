import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import {
  buildRecoveryCodeSet,
  clearStepUp,
  hasRecentStepUp,
  isMfaRequiredForRoles,
  isSessionMfaVerified,
  markStepUp,
} from "@/lib/mfa";

export function useMfaAuth() {
  const { session, refreshProfile } = useAuth();
  const { roles } = useUserRoles();

  const isRequired = useMemo(() => isMfaRequiredForRoles(roles), [roles]);
  const isVerified = useMemo(() => isSessionMfaVerified(session?.access_token), [session?.access_token]);

  const listFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data;
  };

  const enroll = async (friendlyName: string) => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });
    if (error) throw error;
    return data;
  };

  const verifyCode = async (factorId: string, code: string) => {
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) throw error;

    markStepUp();
    await refreshProfile();
    return data;
  };

  const generateRecoveryCodes = async () => {
    const codes = buildRecoveryCodeSet();
    const { error } = await supabase.rpc("mfa_replace_recovery_codes", {
      p_codes: codes,
    });
    if (error) throw error;
    return codes;
  };

  const recoverWithCode = async (code: string) => {
    const { data, error } = await supabase.rpc("mfa_consume_recovery_code", {
      p_code: code,
    });
    if (error) throw error;
    if (!data) {
      throw new Error("Código de recuperação inválido ou já utilizado.");
    }

    markStepUp();
    return true;
  };

  const resetStepUp = () => clearStepUp();

  return {
    isRequired,
    isVerified,
    hasRecentStepUp: hasRecentStepUp(),
    listFactors,
    enroll,
    verifyCode,
    generateRecoveryCodes,
    recoverWithCode,
    markStepUp,
    resetStepUp,
  };
}
