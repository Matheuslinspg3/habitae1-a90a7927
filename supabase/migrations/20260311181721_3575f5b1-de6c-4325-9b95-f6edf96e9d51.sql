
-- 1. Tabela singleton de configuração
CREATE TABLE public.app_runtime_config (
  id text PRIMARY KEY DEFAULT 'singleton',
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'Estamos em manutenção para migração de dados. Tente novamente em alguns minutos.',
  maintenance_started_at timestamptz,
  maintenance_started_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabela de auditoria
CREATE TABLE public.maintenance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  performed_by uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  previous_value boolean NOT NULL,
  new_value boolean NOT NULL,
  maintenance_message text,
  ip_address text,
  user_agent text
);

-- 3. Inserir row singleton
INSERT INTO public.app_runtime_config (id) VALUES ('singleton');

-- 4. RLS: app_runtime_config
ALTER TABLE public.app_runtime_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read config"
  ON public.app_runtime_config FOR SELECT
  TO anon, authenticated
  USING (true);

-- Nenhuma policy de INSERT/UPDATE/DELETE → somente service_role pode alterar

-- 5. RLS: maintenance_audit_log
ALTER TABLE public.maintenance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can read audit log"
  ON public.maintenance_audit_log FOR SELECT
  TO authenticated
  USING (public.is_system_admin());

-- Nenhuma policy de INSERT → somente service_role pode inserir

-- 6. Função is_maintenance_blocked()
CREATE OR REPLACE FUNCTION public.is_maintenance_blocked()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_runtime_config
    WHERE id = 'singleton' AND maintenance_mode = true
  ) AND NOT public.is_system_admin();
$$;

-- 7. Policies RLS restritivas para tabelas críticas durante manutenção
-- Properties
CREATE POLICY "Block inserts during maintenance" ON public.properties
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.properties
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());

CREATE POLICY "Block deletes during maintenance" ON public.properties
  FOR DELETE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- Leads
CREATE POLICY "Block inserts during maintenance" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.leads
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());

CREATE POLICY "Block deletes during maintenance" ON public.leads
  FOR DELETE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- Contracts
CREATE POLICY "Block inserts during maintenance" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.contracts
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());

CREATE POLICY "Block deletes during maintenance" ON public.contracts
  FOR DELETE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- Invoices
CREATE POLICY "Block inserts during maintenance" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.invoices
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());

CREATE POLICY "Block deletes during maintenance" ON public.invoices
  FOR DELETE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- Tasks
CREATE POLICY "Block inserts during maintenance" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.tasks
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- Appointments
CREATE POLICY "Block inserts during maintenance" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.appointments
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- Commissions
CREATE POLICY "Block inserts during maintenance" ON public.commissions
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.commissions
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());

-- Transactions
CREATE POLICY "Block inserts during maintenance" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_maintenance_blocked());

CREATE POLICY "Block updates during maintenance" ON public.transactions
  FOR UPDATE TO authenticated
  USING (NOT public.is_maintenance_blocked());
