
-- Drop table if partially created from failed migration
DROP TABLE IF EXISTS public.user_roles CASCADE;

-- Criar tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função SECURITY DEFINER para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), _role)
$$;

-- RLS policies para user_roles
CREATE POLICY "Users can view own roles or developers see all"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Developers can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));

-- Atribuir role developer ao admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('33c17066-efae-4dc6-94f7-42c9d7235386', 'developer');

-- RLS: Leaders/Developers podem ver todos os imóveis
CREATE POLICY "Leaders can view all properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (public.current_user_has_role('leader') OR public.current_user_has_role('developer'));

CREATE POLICY "Leaders can view all property images"
  ON public.property_images FOR SELECT
  TO authenticated
  USING (public.current_user_has_role('leader') OR public.current_user_has_role('developer'));

CREATE POLICY "Leaders can view all property media"
  ON public.property_media FOR SELECT
  TO authenticated
  USING (public.current_user_has_role('leader') OR public.current_user_has_role('developer'));

-- Developers podem ver todos os perfis e orgs
CREATE POLICY "Developers can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_user_has_role('developer'));

CREATE POLICY "Developers can view all organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.current_user_has_role('developer'));
