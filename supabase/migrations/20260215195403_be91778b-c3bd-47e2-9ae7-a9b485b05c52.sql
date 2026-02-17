
-- Function to normalize phone numbers (remove non-numeric chars)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text AS $$
BEGIN
  RETURN regexp_replace(phone, '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Table: owners (centralized owner registry)
CREATE TABLE public.owners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  primary_name text NOT NULL,
  phone text NOT NULL,
  email text,
  document text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owners_org_phone_unique UNIQUE (organization_id, phone)
);

-- Table: owner_aliases (name variations)
CREATE TABLE public.owner_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  name text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add owner_id to property_owners
ALTER TABLE public.property_owners
  ADD COLUMN owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_aliases ENABLE ROW LEVEL SECURITY;

-- RLS for owners
CREATE POLICY "Users can view owners in their org"
  ON public.owners FOR SELECT
  USING (is_member_of_org(organization_id));

CREATE POLICY "Users can create owners in their org"
  ON public.owners FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update owners in their org"
  ON public.owners FOR UPDATE
  USING (is_member_of_org(organization_id));

CREATE POLICY "Admins can delete owners in their org"
  ON public.owners FOR DELETE
  USING (is_member_of_org(organization_id) AND is_org_admin(auth.uid()));

-- RLS for owner_aliases (through owner's org)
CREATE POLICY "Users can view aliases of their org owners"
  ON public.owner_aliases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.owners o
    WHERE o.id = owner_aliases.owner_id AND is_member_of_org(o.organization_id)
  ));

CREATE POLICY "Users can create aliases for their org owners"
  ON public.owner_aliases FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.owners o
    WHERE o.id = owner_aliases.owner_id AND o.organization_id = get_user_organization_id()
  ));

CREATE POLICY "Users can update aliases for their org owners"
  ON public.owner_aliases FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.owners o
    WHERE o.id = owner_aliases.owner_id AND is_member_of_org(o.organization_id)
  ));

CREATE POLICY "Admins can delete aliases"
  ON public.owner_aliases FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.owners o
    WHERE o.id = owner_aliases.owner_id AND is_member_of_org(o.organization_id) AND is_org_admin(auth.uid())
  ));

-- Trigger for updated_at on owners
CREATE TRIGGER update_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_owners_org_id ON public.owners(organization_id);
CREATE INDEX idx_owners_phone ON public.owners(phone);
CREATE INDEX idx_owners_primary_name ON public.owners(primary_name);
CREATE INDEX idx_owner_aliases_owner_id ON public.owner_aliases(owner_id);
CREATE INDEX idx_property_owners_owner_id ON public.property_owners(owner_id);

-- Migrate existing data: create owners from property_owners grouped by normalized phone
DO $$
DECLARE
  r RECORD;
  new_owner_id uuid;
  best_name text;
BEGIN
  -- For each unique (organization_id, normalized_phone) group
  FOR r IN
    SELECT
      organization_id,
      normalize_phone(phone) AS norm_phone,
      phone AS original_phone,
      array_agg(DISTINCT name) AS names,
      (SELECT po2.email FROM property_owners po2
       WHERE po2.organization_id = po.organization_id
         AND normalize_phone(po2.phone) = normalize_phone(po.phone)
         AND po2.email IS NOT NULL
       LIMIT 1) AS sample_email,
      (SELECT po2.document FROM property_owners po2
       WHERE po2.organization_id = po.organization_id
         AND normalize_phone(po2.phone) = normalize_phone(po.phone)
         AND po2.document IS NOT NULL
       LIMIT 1) AS sample_document,
      (SELECT po2.notes FROM property_owners po2
       WHERE po2.organization_id = po.organization_id
         AND normalize_phone(po2.phone) = normalize_phone(po.phone)
         AND po2.notes IS NOT NULL
       LIMIT 1) AS sample_notes
    FROM property_owners po
    WHERE phone IS NOT NULL AND phone <> ''
    GROUP BY organization_id, normalize_phone(phone), phone
  LOOP
    -- Find the most frequent name
    SELECT name INTO best_name
    FROM property_owners
    WHERE organization_id = r.organization_id
      AND normalize_phone(phone) = r.norm_phone
    GROUP BY name
    ORDER BY count(*) DESC
    LIMIT 1;

    -- Insert owner (skip if phone already exists for this org)
    INSERT INTO public.owners (organization_id, primary_name, phone, email, document, notes)
    VALUES (r.organization_id, best_name, r.norm_phone, r.sample_email, r.sample_document, r.sample_notes)
    ON CONFLICT (organization_id, phone) DO NOTHING
    RETURNING id INTO new_owner_id;

    -- If we got the id (new insert), create aliases
    IF new_owner_id IS NOT NULL THEN
      -- Create aliases for each distinct name
      INSERT INTO public.owner_aliases (owner_id, name, occurrence_count)
      SELECT new_owner_id, sub.name, sub.cnt
      FROM (
        SELECT name, count(*) AS cnt
        FROM property_owners
        WHERE organization_id = r.organization_id
          AND normalize_phone(phone) = r.norm_phone
        GROUP BY name
      ) sub;

      -- Link property_owners to the new owner
      UPDATE property_owners
      SET owner_id = new_owner_id
      WHERE organization_id = r.organization_id
        AND normalize_phone(phone) = r.norm_phone;
    END IF;
  END LOOP;
END $$;
