
-- Trigger function: when a property_owner is inserted/updated with a phone,
-- upsert into the unified owners table and link back via owner_id.
CREATE OR REPLACE FUNCTION public.sync_property_owner_to_owners()
RETURNS TRIGGER AS $$
DECLARE
  _phone_clean text;
  _owner_id uuid;
BEGIN
  -- Only process if we have a phone number (dedup key)
  IF NEW.phone IS NULL OR trim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  -- Normalize phone to digits only
  _phone_clean := regexp_replace(trim(NEW.phone), '[^0-9]', '', 'g');

  IF _phone_clean = '' THEN
    RETURN NEW;
  END IF;

  -- Try to find existing owner by normalized phone in same org
  SELECT id INTO _owner_id
  FROM public.owners
  WHERE organization_id = NEW.organization_id
    AND regexp_replace(trim(phone), '[^0-9]', '', 'g') = _phone_clean
  LIMIT 1;

  IF _owner_id IS NULL THEN
    -- Create new owner
    INSERT INTO public.owners (organization_id, primary_name, phone, email, document)
    VALUES (
      NEW.organization_id,
      COALESCE(NEW.name, 'Proprietário'),
      _phone_clean,
      NEW.email,
      NEW.document
    )
    RETURNING id INTO _owner_id;
  ELSE
    -- Add alias if the name is different from primary_name
    IF NEW.name IS NOT NULL AND NEW.name <> '' THEN
      PERFORM 1 FROM public.owners WHERE id = _owner_id AND primary_name = NEW.name;
      IF NOT FOUND THEN
        INSERT INTO public.owner_aliases (owner_id, name, occurrence_count)
        VALUES (_owner_id, NEW.name, 1)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- Link the property_owner to the unified owner
  NEW.owner_id := _owner_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_sync_property_owner ON public.property_owners;
CREATE TRIGGER trg_sync_property_owner
  BEFORE INSERT OR UPDATE ON public.property_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_property_owner_to_owners();
