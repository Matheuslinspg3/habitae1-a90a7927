
-- Fix get_schema_tables_ddl: robust computed-default detection using column cross-reference
CREATE OR REPLACE FUNCTION public.get_schema_tables_ddl()
RETURNS TABLE(table_name text, ddl text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  rec2 RECORD;
  col_defs text[];
  pk_cols text[];
  v_expr text;
  v_default text;
  v_is_computed boolean;
BEGIN
  FOR rec IN 
    SELECT c.relname::text AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    col_defs := ARRAY[]::text[];

    FOR rec2 IN
      SELECT a.attname, a.atttypid, a.atttypmod, a.attnotnull,
             d.adbin, d.adrelid, a.attrelid, a.attnum
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = ('public.' || rec.tname)::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    LOOP
      v_default := '';
      IF rec2.adbin IS NOT NULL THEN
        v_expr := pg_get_expr(rec2.adbin, rec2.adrelid);
        -- Check if expression references another column of the same table
        v_is_computed := false;
        IF EXISTS (
          SELECT 1 FROM pg_attribute a2
          WHERE a2.attrelid = rec2.attrelid
            AND a2.attnum > 0
            AND NOT a2.attisdropped
            AND a2.attnum <> rec2.attnum
            AND v_expr ~ ('\m' || a2.attname::text || '\M')
        ) THEN
          v_is_computed := true;
        END IF;
        IF NOT v_is_computed THEN
          v_default := ' DEFAULT ' || v_expr;
        END IF;
      END IF;

      col_defs := array_append(col_defs, format('  %I %s%s%s',
        rec2.attname,
        pg_catalog.format_type(rec2.atttypid, rec2.atttypmod),
        CASE WHEN rec2.attnotnull THEN ' NOT NULL' ELSE '' END,
        v_default
      ));
    END LOOP;

    SELECT array_agg(a.attname ORDER BY array_position(i.indkey, a.attnum))::text[]
    INTO pk_cols
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = ('public.' || rec.tname)::regclass AND i.indisprimary;

    IF pk_cols IS NOT NULL THEN
      col_defs := array_append(col_defs, '  PRIMARY KEY (' || array_to_string(pk_cols, ', ') || ')');
    END IF;

    table_name := rec.tname;
    ddl := format(E'CREATE TABLE IF NOT EXISTS public.%I (\n%s\n);', rec.tname, array_to_string(col_defs, E',\n'));
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Column types function for proper INSERT generation (array vs jsonb distinction)
CREATE OR REPLACE FUNCTION public.get_schema_column_types()
RETURNS TABLE(table_name text, column_name text, udt_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT c.table_name::text, c.column_name::text, c.udt_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  ORDER BY c.table_name, c.ordinal_position;
$$;
