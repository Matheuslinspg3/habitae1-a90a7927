import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { loginOneSignal, logoutOneSignal } from '@/lib/onesignal';

interface Profile {
  id: string;
  user_id: string;
  organization_id: string | null;
  full_name: string;
  phone: string | null;
  creci: string | null;
  onboarding_completed: boolean | null;
  avatar_url: string | null;
  email_verified: boolean | null;
  phone_verified: boolean | null;
  creci_verified: boolean | null;
  creci_verified_at: string | null;
  creci_verified_name: string | null;
}

interface TrialInfo {
  trial_started_at: string | null;
  trial_ends_at: string | null;
  is_active: boolean;
  is_trial_expired: boolean;
}

interface SignUpParams {
  email: string;
  password: string;
  name: string;
  phone: string;
  accountType: 'corretor_individual' | 'imobiliaria';
  companyName?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organizationType: 'imobiliaria' | 'corretor_individual' | null;
  trialInfo: TrialInfo | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizationType, setOrganizationType] = useState<'imobiliaria' | 'corretor_individual' | null>(null);
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      // Add timeout to prevent infinite loading when DB is unreachable
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .abortSignal(controller.signal)
        .single();

      clearTimeout(timeout);

      if (!error && data) {
        setProfile(data as Profile);
        // Fetch organization type
        if (data.organization_id) {
          const orgController = new AbortController();
          const orgTimeout = setTimeout(() => orgController.abort(), 8_000);
          const { data: orgData } = await supabase
            .from('organizations')
            .select('type, trial_started_at, trial_ends_at, is_active')
            .eq('id', data.organization_id)
            .abortSignal(orgController.signal)
            .single();
          clearTimeout(orgTimeout);
          if (orgData) {
            setOrganizationType(orgData.type as 'imobiliaria' | 'corretor_individual');
            const trialEnds = orgData.trial_ends_at ? new Date(orgData.trial_ends_at) : null;
            const isTrialExpired = trialEnds !== null && trialEnds < new Date();
            setTrialInfo({
              trial_started_at: orgData.trial_started_at,
              trial_ends_at: orgData.trial_ends_at,
              is_active: orgData.is_active,
              is_trial_expired: isTrialExpired && orgData.is_active,
            });
          }
        }
        return data as Profile;
      }
      return null;
    } catch (err) {
      console.error('[Auth] fetchProfile failed (timeout or network):', err);
      return null;
    }
  };

  // Função para corrigir usuários legados sem organização
  const fixLegacyUser = async (userId: string, email: string, fullName: string) => {
    console.log('Corrigindo usuário legado sem organização...');
    
    const { data, error } = await supabase.rpc('fix_user_without_organization', {
      p_user_id: userId,
      p_email: email,
      p_full_name: fullName
    });

    if (error) {
      console.error('Erro ao corrigir usuário legado:', error);
      return null;
    }

    // Buscar perfil atualizado
    await fetchProfile(userId);
    return data;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Usar setTimeout para evitar deadlock com Supabase
          setTimeout(async () => {
            try {
              // Trigger já criou tudo - apenas buscar perfil
              const existingProfile = await fetchProfile(session.user.id);
              
              // Fallback para usuários legados sem organização
              if (!existingProfile?.organization_id) {
                const metadata = session.user.user_metadata;
                const fullName = metadata?.full_name || 'Usuário';
                await fixLegacyUser(session.user.id, session.user.email!, fullName);
              }
              
              // Vincular usuário ao OneSignal
              loginOneSignal(session.user.id).catch(e => console.error("[Auth] OneSignal login error:", e));
            } catch (err) {
              console.error('[Auth] Error during session setup:', err);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          const existingProfile = await fetchProfile(session.user.id);
          
          if (!existingProfile?.organization_id) {
            const metadata = session.user.user_metadata;
            const fullName = metadata?.full_name || 'Usuário';
            await fixLegacyUser(session.user.id, session.user.email!, fullName);
          }
          
          loginOneSignal(session.user.id).catch(e => console.error("[Auth] OneSignal login error:", e));
        } catch (err) {
          console.error('[Auth] Error during initial session setup:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async ({ email, password, name, phone, accountType, companyName }: SignUpParams) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Trigger no banco de dados vai criar organização/perfil/role automaticamente
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: name,
          phone: phone,
          account_type: accountType,
          company_name: companyName,
        }
      }
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setProfile(null);
    setOrganizationType(null);
    logoutOneSignal();
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      organizationType,
      trialInfo,
      loading, 
      signUp, 
      signIn, 
      signOut, 
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During HMR or edge cases, return safe defaults instead of crashing
    if (import.meta.hot) {
      console.warn('[AuthContext] Context not available (HMR reload). Returning defaults.');
      return {
        user: null,
        session: null,
        profile: null,
        organizationType: null,
        trialInfo: null,
        loading: true,
        signUp: async () => ({ error: new Error('Auth not ready') }),
        signIn: async () => ({ error: new Error('Auth not ready') }),
        signOut: async () => {},
        refreshProfile: async () => {},
      } as AuthContextType;
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
