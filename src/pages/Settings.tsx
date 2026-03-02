import { useState, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, User, Bell, Users, Upload, Palette, Sun, Moon, Monitor, Loader2, Megaphone, Camera, CreditCard, History, ShieldCheck, Mail, Crown, Shield, Bug } from "lucide-react";
import { SupportTicketDialog } from "@/components/settings/SupportTicketDialog";
import { cn } from "@/lib/utils";
import { PillBadge } from "@/components/ui/pill-badge";
import { TeamInviteSection } from "@/components/settings/TeamInviteSection";
import { PlatformInviteSection } from "@/components/settings/PlatformInviteSection";
import { UnifiedPlanSection } from "@/components/settings/UnifiedPlanSection";
import { VerificationSection } from "@/components/settings/VerificationSection";
import { ChangelogSection } from "@/components/settings/ChangelogSection";
import { useImageUpload } from "@/hooks/useImageUpload";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const BRAZILIAN_STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function Settings() {
  const { user, profile, refreshProfile, organizationType } = useAuth();
  const { hasRole, isDeveloperOrLeader, isAdmin, isDeveloper, isAdminOrAbove } = useUserRoles();
  const { theme, setTheme } = useTheme();
  const { uploadImage, isUploading: isUploadingAvatar } = useImageUpload();
  const queryClient = useQueryClient();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [creci, setCreci] = useState("");
  const [creciState, setCreciState] = useState("SP");
  const [savingProfile, setSavingProfile] = useState(false);
  const [verifyingCreci, setVerifyingCreci] = useState(false);

  // Password state
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);

  // Company state
  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyStreet, setCompanyStreet] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [companyComplement, setCompanyComplement] = useState("");
  const [companyNeighborhood, setCompanyNeighborhood] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyZipcode, setCompanyZipcode] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Load profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setCreci(profile.creci || "");
      setEmail(user?.email || "");
    }
  }, [profile, user?.email]);

  // Load organization data
  useEffect(() => {
    if (!profile?.organization_id) return;
    const loadOrg = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("name, cnpj, phone, email, logo_url, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zipcode")
        .eq("id", profile.organization_id!)
        .maybeSingle();
      if (data) {
        setCompanyName(data.name || "");
        setCompanyCnpj(data.cnpj || "");
        setCompanyPhone(data.phone || "");
        setCompanyEmail(data.email || "");
        setCompanyLogoUrl(data.logo_url || "");
        setCompanyStreet(data.address_street || "");
        setCompanyNumber(data.address_number || "");
        setCompanyComplement(data.address_complement || "");
        setCompanyNeighborhood(data.address_neighborhood || "");
        setCompanyCity(data.address_city || "");
        setCompanyState(data.address_state || "");
        setCompanyZipcode(data.address_zipcode || "");
      }
    };
    loadOrg();
  }, [profile?.organization_id]);

  // Load team members
  useEffect(() => {
    if (!profile?.organization_id) return;
    const loadTeam = async () => {
      setLoadingTeam(true);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", profile.organization_id!);

      if (profiles) {
        const userIds = profiles.map(p => p.user_id);
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);

        const { data: emails } = await supabase
          .rpc("get_org_member_emails", { org_id: profile.organization_id! });

        const members: TeamMember[] = profiles.map((p) => {
          const userRole = roles?.find((r) => r.user_id === p.user_id);
          const memberEmail = (emails as any[])?.find((e: any) => e.user_id === p.user_id)?.email || "";
          return {
            user_id: p.user_id,
            full_name: p.full_name,
            email: memberEmail,
            role: userRole?.role || "corretor",
          };
        });
        setTeamMembers(members);
      }
      setLoadingTeam(false);
    };
    loadTeam();
  }, [profile?.organization_id]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);

    // 1. Email changed? Trigger re-verification
    const emailChanged = email.trim().toLowerCase() !== (user?.email || "").toLowerCase();
    if (emailChanged) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
      if (emailError) {
        toast.error("Erro ao alterar e-mail: " + emailError.message);
        setSavingProfile(false);
        return;
      }
      toast.info("Um link de confirmação foi enviado para o novo e-mail. A alteração só será efetivada após a confirmação.");
    }

    // 2. CRECI changed? Auto-verify before saving
    const creciChanged = creci.trim() !== (profile.creci || "").trim();
    if (creciChanged && creci.trim()) {
      setVerifyingCreci(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada");

        const response = await supabase.functions.invoke("verify-creci", {
          body: {
            action: "verify-creci",
            creci_number: creci.trim(),
            user_name: fullName,
            creci_state: creciState,
          },
        });

        if (response.error) throw response.error;

        const result = response.data as { verified: boolean; message: string };
        if (!result.verified) {
          toast.error("CRECI não verificado: " + result.message);
          setVerifyingCreci(false);
          setSavingProfile(false);
          return;
        }

        toast.success("CRECI verificado com sucesso!");
      } catch (err: any) {
        toast.error("Erro ao verificar CRECI: " + (err.message || "Tente novamente"));
        setVerifyingCreci(false);
        setSavingProfile(false);
        return;
      }
      setVerifyingCreci(false);
    }

    // 3. Save profile (CRECI verified or unchanged)
    const updateData: Record<string, any> = { full_name: fullName, phone, creci: creci.trim() };
    if (creciChanged && !creci.trim()) {
      // Cleared CRECI — reset verification
      updateData.creci_verified = false;
      updateData.creci_verified_at = null;
      updateData.creci_verified_name = null;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", profile.id);
    setSavingProfile(false);
    if (error) {
      toast.error("Erro ao salvar perfil");
    } else {
      toast.success("Perfil atualizado com sucesso");
      refreshProfile();
    }
  };

  const handleSendPasswordReset = async () => {
    const userEmail = user?.email;
    if (!userEmail) return toast.error("E-mail não encontrado");
    setSendingResetLink(true);
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: window.location.origin + "/configuracoes",
    });
    setSendingResetLink(false);
    if (error) {
      toast.error("Erro ao enviar link de redefinição: " + error.message);
    } else {
      setResetLinkSent(true);
      toast.success("Link de redefinição enviado para " + userEmail);
    }
  };

  const isBrokerOrAssistant = !isAdminOrAbove;
  const canEditCompany = isAdminOrAbove;

  const handleSaveCompany = async () => {
    if (!profile?.organization_id || !canEditCompany) return;
    setSavingCompany(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: companyName,
        cnpj: companyCnpj,
        phone: companyPhone,
        email: companyEmail,
        logo_url: companyLogoUrl || null,
        address_street: companyStreet || null,
        address_number: companyNumber || null,
        address_complement: companyComplement || null,
        address_neighborhood: companyNeighborhood || null,
        address_city: companyCity || null,
        address_state: companyState || null,
        address_zipcode: companyZipcode || null,
      })
      .eq("id", profile.organization_id);
    setSavingCompany(false);
    if (error) {
      toast.error("Erro ao salvar dados da empresa");
    } else {
      toast.success("Dados da empresa atualizados");
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Dono";
      case "sub_admin": return "Sub-Dono";
      case "developer": return "Developer";
      case "leader": return "Leader";
      case "assistente": return "Assistente";
      default: return "Corretor";
    }
  };

  const ASSIGNABLE_ROLES = [
    { value: "corretor", label: "Corretor", description: "Acesso básico a leads e imóveis atribuídos" },
    { value: "assistente", label: "Assistente", description: "Suporte administrativo sem gestão de equipe" },
    { value: "sub_admin", label: "Sub-Dono", description: "Gestão completa, visibilidade total da organização" },
    ...(isDeveloper ? [{ value: "admin", label: "Dono", description: "Proprietário da organização com controle total" }] : []),
  ];

  const handleChangeRole = async (memberId: string, newRole: string) => {
    // Usar delete + insert para consistência com Administration.tsx
    const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", memberId);
    if (deleteError) {
      toast.error("Erro ao alterar cargo");
      return;
    }
    const { error: insertError } = await supabase.from("user_roles").insert({ user_id: memberId, role: newRole as any });
    if (insertError) {
      toast.error("Erro ao alterar cargo");
      return;
    }
    setTeamMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: newRole } : m));
    const member = teamMembers.find(m => m.user_id === memberId);
    toast.success(`Cargo de ${member?.full_name} alterado para ${roleLabel(newRole)}`);
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações do sistema"
        actions={
          <SupportTicketDialog
            trigger={
              <Button variant="outline" size="sm" className="gap-2">
                <Bug className="h-4 w-4" />
                <span className="hidden sm:inline">Reportar problema</span>
                <span className="sm:hidden">Reportar</span>
              </Button>
            }
          />
        }
      />
      
      <div className="relative flex-1 p-4 sm:p-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
            <TabsList className="inline-flex w-auto min-w-full sm:min-w-0 h-auto flex-wrap sm:flex-nowrap gap-1 p-1">
              <TabsTrigger value="profile" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><User className="h-4 w-4 shrink-0" /><span>Perfil</span></TabsTrigger>
              <TabsTrigger value="company" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Building2 className="h-4 w-4 shrink-0" /><span>Empresa</span></TabsTrigger>
              {isAdminOrAbove && (
                <TabsTrigger value="team" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Users className="h-4 w-4 shrink-0" /><span>Equipe</span></TabsTrigger>
              )}
              <TabsTrigger value="appearance" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Palette className="h-4 w-4 shrink-0" /><span>Aparência</span></TabsTrigger>
              {isAdminOrAbove && (
                <TabsTrigger value="changelog" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><History className="h-4 w-4 shrink-0" /><span>Histórico</span></TabsTrigger>
              )}
              {isDeveloperOrLeader && (
                <TabsTrigger value="clients" className="gap-2 min-h-[44px] text-xs sm:text-sm px-3 sm:px-4"><Megaphone className="h-4 w-4 shrink-0" /><span>Clientes</span></TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="profile">
            <div className="grid gap-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Pessoais</CardTitle>
                  <CardDescription>Atualize seus dados de perfil</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <Avatar className="h-20 w-20">
                        {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={fullName} />}
                        <AvatarFallback className="text-lg">
                          {fullName ? getInitials(fullName) : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <label className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <Camera className="h-5 w-5 text-background" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingAvatar}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !profile) return;
                            const result = await uploadImage(file, 'avatars');
                            if (result) {
                              await supabase
                                .from("profiles")
                                .update({ avatar_url: result.url })
                                .eq("id", profile.id);
                              refreshProfile();
                              toast.success("Foto atualizada!");
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div>
                      <p className="font-medium">{fullName || "Usuário"}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      {companyName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {companyName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome completo</Label>
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      {email.trim().toLowerCase() !== (user?.email || "").toLowerCase() && (
                        <p className="text-xs text-muted-foreground">Um link de confirmação será enviado ao novo e-mail.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="creci">CRECI</Label>
                      <div className="flex gap-2">
                        <Select value={creciState} onValueChange={setCreciState}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BRAZILIAN_STATES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input id="creci" value={creci} onChange={(e) => setCreci(e.target.value)} placeholder="000000-F" className="flex-1" />
                      </div>
                      {creci.trim() !== (profile?.creci || "").trim() && creci.trim() && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          O CRECI será verificado automaticamente ao salvar.
                        </p>
                      )}
                    </div>
                    </div>

                  {organizationType && (
                    <div className="space-y-2">
                      <Label>Tipo de conta</Label>
                      <div>
                        <PillBadge
                          variant={organizationType === 'imobiliaria' ? 'warning' : 'muted'}
                          icon={organizationType === 'imobiliaria' ? <Building2 className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                        >
                          {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
                        </PillBadge>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={handleSaveProfile} disabled={savingProfile || verifyingCreci}>
                      {(savingProfile || verifyingCreci) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {verifyingCreci ? "Verificando CRECI..." : "Salvar alterações"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alterar Senha</CardTitle>
                  <CardDescription>Para sua segurança, enviaremos um link de redefinição ao seu e-mail</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Ao clicar no botão abaixo, um e-mail com um link seguro será enviado para <strong>{user?.email}</strong>. 
                    Clique no link para definir sua nova senha.
                  </p>
                  {resetLinkSent && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm">
                      <Mail className="h-4 w-4 text-primary shrink-0" />
                      <span>Link enviado! Verifique sua caixa de entrada e spam.</span>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={handleSendPasswordReset} disabled={sendingResetLink}>
                      {sendingResetLink && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar link de redefinição
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <VerificationSection />

              <UnifiedPlanSection />
            </div>
          </TabsContent>

          <TabsContent value="company">
            <div className="grid gap-6 max-w-2xl">
              {!canEditCompany && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Apenas donos e sub-donos podem alterar os dados da empresa.
                </div>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Dados da Empresa</CardTitle>
                  <CardDescription>Informações da sua organização</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Logo */}
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <Avatar className="h-20 w-20 rounded-lg">
                        {companyLogoUrl && <AvatarImage src={companyLogoUrl} alt={companyName} className="rounded-lg" />}
                        <AvatarFallback className="text-lg rounded-lg">
                          <Building2 className="h-8 w-8 text-muted-foreground" />
                        </AvatarFallback>
                      </Avatar>
                      {canEditCompany && (
                        <label className="absolute inset-0 flex items-center justify-center bg-foreground/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <Camera className="h-5 w-5 text-background" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingAvatar}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !profile?.organization_id) return;
                              const result = await uploadImage(file, 'logos');
                              if (result) {
                                setCompanyLogoUrl(result.url);
                                await supabase
                                  .from("organizations")
                                  .update({ logo_url: result.url })
                                  .eq("id", profile.organization_id);
                                toast.success("Logo atualizado!");
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{companyName || "Sua empresa"}</p>
                      <p className="text-sm text-muted-foreground">
                        {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Nome da empresa</Label>
                      <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!canEditCompany} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input id="cnpj" value={companyCnpj} onChange={(e) => setCompanyCnpj(e.target.value)} placeholder="00.000.000/0001-00" disabled={!canEditCompany} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Telefone</Label>
                      <Input id="company-phone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} disabled={!canEditCompany} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email</Label>
                      <Input id="company-email" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} disabled={!canEditCompany} />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-medium mb-4">Endereço</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="company-zipcode">CEP</Label>
                        <Input id="company-zipcode" value={companyZipcode} onChange={(e) => setCompanyZipcode(e.target.value)} placeholder="00000-000" disabled={!canEditCompany} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-state">Estado</Label>
                        <Select value={companyState} onValueChange={setCompanyState} disabled={!canEditCompany}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {BRAZILIAN_STATES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-city">Cidade</Label>
                        <Input id="company-city" value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} disabled={!canEditCompany} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-neighborhood">Bairro</Label>
                        <Input id="company-neighborhood" value={companyNeighborhood} onChange={(e) => setCompanyNeighborhood(e.target.value)} disabled={!canEditCompany} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="company-street">Rua</Label>
                        <Input id="company-street" value={companyStreet} onChange={(e) => setCompanyStreet(e.target.value)} disabled={!canEditCompany} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-number">Número</Label>
                        <Input id="company-number" value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} disabled={!canEditCompany} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-complement">Complemento</Label>
                        <Input id="company-complement" value={companyComplement} onChange={(e) => setCompanyComplement(e.target.value)} disabled={!canEditCompany} />
                      </div>
                    </div>
                  </div>

                  {canEditCompany && (
                    <div className="flex justify-end">
                      <Button onClick={handleSaveCompany} disabled={savingCompany}>
                        {savingCompany && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Salvar alterações
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="team">
            <div className="grid gap-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Membros da Equipe</CardTitle>
                      <CardDescription>Usuários da sua organização</CardDescription>
                    </div>
                    {organizationType && (
                      <PillBadge
                        size="sm"
                        variant={organizationType === 'imobiliaria' ? 'warning' : 'muted'}
                        icon={organizationType === 'imobiliaria' ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      >
                        {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
                      </PillBadge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingTeam ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nenhum membro encontrado</p>
                  ) : (
                     <div className="space-y-3">
                      {teamMembers.map((member) => {
                        const isCurrentUser = member.user_id === user?.id;
                        const isSystemRole = member.role === "developer" || member.role === "leader";
                        const isMemberAdmin = member.role === "admin";
                        const canChangeRole = (isAdmin || isDeveloper) && !isCurrentUser && !isSystemRole && !(isMemberAdmin && !isDeveloper);

                        return (
                          <div key={member.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarFallback>{getInitials(member.full_name)}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{member.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {member.email}{isCurrentUser && " (você)"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pl-13 sm:pl-0 shrink-0">
                              {canChangeRole ? (
                                <Select value={member.role} onValueChange={(val) => handleChangeRole(member.user_id, val)}>
                                  <SelectTrigger className="w-full sm:w-[140px] min-h-[40px] sm:min-h-[32px] text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ASSIGNABLE_ROLES.map((r) => (
                                      <SelectItem key={r.value} value={r.value}>
                                        <div>
                                          <span>{r.label}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <PillBadge
                                  size="sm"
                                  variant={isMemberAdmin ? 'default' : member.role === 'sub_admin' ? 'warning' : 'muted'}
                                  icon={isMemberAdmin ? <Crown className="h-3 w-3" /> : member.role === 'sub_admin' ? <Shield className="h-3 w-3" /> : undefined}
                                >
                                  {roleLabel(member.role)}
                                </PillBadge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <TeamInviteSection />
            </div>
          </TabsContent>

          <TabsContent value="appearance">
            <div className="grid gap-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Tema</CardTitle>
                  <CardDescription>Escolha como a interface deve aparecer</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all hover:bg-accent",
                        theme === 'light' ? "border-primary bg-accent" : "border-transparent bg-muted/50"
                      )}
                    >
                      <div className="w-12 h-12 rounded-full bg-background border-2 flex items-center justify-center">
                        <Sun className="h-6 w-6 text-yellow-500" />
                      </div>
                      <span className="text-sm font-medium">Claro</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all hover:bg-accent",
                        theme === 'dark' ? "border-primary bg-accent" : "border-transparent bg-muted/50"
                      )}
                    >
                      <div className="w-12 h-12 rounded-full bg-muted border-2 flex items-center justify-center">
                        <Moon className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-medium">Escuro</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={cn(
                        "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-all hover:bg-accent",
                        theme === 'system' ? "border-primary bg-accent" : "border-transparent bg-muted/50"
                      )}
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-background to-muted border-2 flex items-center justify-center">
                        <Monitor className="h-6 w-6" />
                      </div>
                      <span className="text-sm font-medium">Sistema</span>
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    O tema "Sistema" acompanha automaticamente as configurações do seu dispositivo.
                  </p>
                </CardContent>
              </Card>

              {/* Push Notifications */}
              <PushNotificationCard />
            </div>
          </TabsContent>

          <TabsContent value="changelog">
            <ChangelogSection />
          </TabsContent>

          {isDeveloperOrLeader && (
            <TabsContent value="clients">
              <div className="grid gap-6 max-w-2xl">
                <PlatformInviteSection />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function PushNotificationCard() {
  const { isSupported, isSubscribed, isLoading, permission, canFetchToken, subscribe, unsubscribe } = usePushNotifications();
  const isIframe = window.self !== window.top;

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push. Use Chrome, Edge ou Firefox para ativar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba notificações em tempo real no seu dispositivo, mesmo com o navegador fechado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isIframe && (
          <div className="rounded-md border border-border/60 bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              ⚠️ Notificações push não funcionam no modo preview (iframe). Teste na{" "}
              <a href="https://habitae1.lovable.app/configuracoes" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                URL publicada
              </a>.
            </p>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">
              {isSubscribed
                ? "Push ativado"
                : !canFetchToken
                  ? "Notificações inativas"
                  : "Push desativado"}
            </p>
            <p className="text-xs text-muted-foreground">
              {permission === "denied"
                ? "Permissão bloqueada nas configurações do navegador"
                : isSubscribed
                  ? "Você receberá alertas de novos leads, imóveis e compromissos"
                  : !canFetchToken
                    ? "As notificações ainda não foram ativadas neste aparelho."
                    : "Ative para ser notificado instantaneamente"}
            </p>
          </div>
          <Switch
            checked={isSubscribed}
            disabled={isLoading || permission === "denied" || isIframe}
            onCheckedChange={(checked) => {
              if (checked) subscribe();
              else unsubscribe();
            }}
          />
        </div>
        {!isSubscribed && !canFetchToken && permission !== "denied" && (
          <div className="rounded-md border border-border/60 bg-muted p-3">
            <p className="text-xs text-muted-foreground">
              Clique no botão abaixo para receber alertas de leads e atualizações diretamente no seu celular ou computador.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => subscribe()}
              disabled={isLoading}
            >
              Ativar notificações
            </Button>
          </div>
        )}
        {permission === "denied" && (
          <p className="text-xs text-destructive">
            As notificações estão bloqueadas. Acesse as configurações do navegador para permitir notificações deste site.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
