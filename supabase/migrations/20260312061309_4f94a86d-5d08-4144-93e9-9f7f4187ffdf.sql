
-- Helper functions for schema export (used by export-database edge function)

-- 1. Get all custom enums
CREATE OR REPLACE FUNCTION public.get_schema_enums()
RETURNS TABLE(enum_name text, enum_values text[])
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT t.typname::text AS enum_name,
         array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[] AS enum_values
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname;
$$;

-- 2. Get CREATE TABLE DDL for all public tables
CREATE OR REPLACE FUNCTION public.get_schema_tables_ddl()
RETURNS TABLE(table_name text, ddl text)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  col_def text;
  col_defs text[];
  pk_cols text[];
  fk_defs text[];
  fk RECORD;
BEGIN
  FOR rec IN 
    SELECT c.relname::text AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    col_defs := ARRAY[]::text[];
    -- columns
    FOR col_def IN
      SELECT format('  %I %s%s%s',
        a.attname,
        pg_catalog.format_type(a.atttypid, a.atttypmod),
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
        CASE WHEN d.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) ELSE '' END
      )
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = ('public.' || rec.tname)::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    LOOP
      col_defs := array_append(col_defs, col_def);
    END LOOP;

    -- primary key
    SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))::text[]
    INTO pk_cols
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = ('public.' || rec.tname)::regclass AND i.indisprimary;

    IF pk_cols IS NOT NULL THEN
      col_defs := array_append(col_defs, '  PRIMARY KEY (' || array_to_string(pk_cols, ', ') || ')');
    END IF;

    -- foreign keys
    fk_defs := ARRAY[]::text[];
    FOR fk IN
      SELECT format('  CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %s(%s)%s',
        con.conname,
        string_agg(a.attname, ', ' ORDER BY array_position(con.conkey, a.attnum)),
        confrel.relname,
        string_agg(af.attname, ', ' ORDER BY array_position(con.confkey, af.attnum)),
        CASE con.confdeltype WHEN 'c' THEN ' ON DELETE CASCADE' WHEN 'n' THEN ' ON DELETE SET NULL' ELSE '' END
      ) AS fk_def
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
      JOIN pg_class confrel ON confrel.oid = con.confrelid
      JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
      WHERE con.conrelid = ('public.' || rec.tname)::regclass AND con.contype = 'f'
      GROUP BY con.conname, confrel.relname, con.confdeltype
    LOOP
      fk_defs := array_append(fk_defs, fk.fk_def);
    END LOOP;
    col_defs := col_defs || fk_defs;

    table_name := rec.tname;
    ddl := format('CREATE TABLE IF NOT EXISTS public.%I (\n%s\n);', rec.tname, array_to_string(col_defs, E',\n'));

    RETURN NEXT;
  END LOOP;
END;
$$;

-- 3. Get all public functions (excluding internal/helper)
CREATE OR REPLACE FUNCTION public.get_schema_functions()
RETURNS TABLE(func_name text, func_def text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT p.proname::text AS func_name,
         pg_get_functiondef(p.oid)::text AS func_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'get_schema_%'
  ORDER BY p.proname;
$$;

-- 4. Get all triggers on public tables
CREATE OR REPLACE FUNCTION public.get_schema_triggers()
RETURNS TABLE(trigger_def text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT pg_get_triggerdef(t.oid)::text AS trigger_def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
  ORDER BY c.relname, t.tgname;
$$;

-- 5. Get all RLS policies
CREATE OR REPLACE FUNCTION public.get_schema_policies()
RETURNS TABLE(policy_def text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT format('CREATE POLICY %I ON public.%I FOR %s TO %s %s %s',
    pol.polname,
    c.relname,
    CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END,
    CASE WHEN pol.polroles = '{0}' THEN 'public' ELSE (SELECT string_agg(rolname, ', ') FROM pg_roles WHERE oid = ANY(pol.polroles)) END,
    CASE WHEN pol.polqual IS NOT NULL THEN 'USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')' ELSE '' END,
    CASE WHEN pol.polwithcheck IS NOT NULL THEN 'WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' ELSE '' END
  )::text AS policy_def
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
  ORDER BY c.relname, pol.polname;
$$;

-- 6. Get all custom indexes (non-primary, non-unique constraint)
CREATE OR REPLACE FUNCTION public.get_schema_indexes()
RETURNS TABLE(index_def text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT pg_get_indexdef(i.indexrelid)::text AS index_def
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_class ic ON ic.oid = i.indexrelid
  WHERE n.nspname = 'public'
    AND NOT i.indisprimary
    AND NOT i.indisunique
  ORDER BY c.relname, ic.relname;
$$;

-- 7. Enable RLS status export
CREATE OR REPLACE FUNCTION public.get_schema_rls_tables()
RETURNS TABLE(table_name text, rls_enabled boolean)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT c.relname::text, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
  ORDER BY c.relname;
$$;
