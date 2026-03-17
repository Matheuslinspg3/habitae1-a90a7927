
-- Replace get_schema_tables_ddl to exclude FK constraints and strip invalid DEFAULT expressions
CREATE OR REPLACE FUNCTION public.get_schema_tables_ddl()
 RETURNS TABLE(table_name text, ddl text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  col_def text;
  col_defs text[];
  pk_cols text[];
  v_default text;
BEGIN
  FOR rec IN 
    SELECT c.relname::text AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    col_defs := ARRAY[]::text[];
    -- columns (NO foreign keys, strip computed defaults)
    FOR col_def IN
      SELECT format('  %I %s%s%s',
        a.attname,
        pg_catalog.format_type(a.atttypid, a.atttypmod),
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
        CASE 
          WHEN d.adbin IS NOT NULL THEN
            CASE
              -- Skip defaults that reference other columns (computed expressions)
              WHEN pg_get_expr(d.adbin, d.adrelid) ~ '\.\w+' THEN ''
              WHEN pg_get_expr(d.adbin, d.adrelid) ~ '^\(.+ [+\-\*/] .+\)$' THEN ''
              ELSE ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid)
            END
          ELSE ''
        END
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

    -- NO foreign keys here - they go in get_schema_fk_constraints

    table_name := rec.tname;
    ddl := format(E'CREATE TABLE IF NOT EXISTS public.%I (\n%s\n);', rec.tname, array_to_string(col_defs, E',\n'));

    RETURN NEXT;
  END LOOP;
END;
$function$;

-- New function: return FK constraints as ALTER TABLE statements
CREATE OR REPLACE FUNCTION public.get_schema_fk_constraints()
 RETURNS TABLE(source_table text, target_table text, constraint_sql text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    c.relname::text AS source_table,
    confrel.relname::text AS target_table,
    format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.%I(%s)%s;',
      c.relname,
      con.conname,
      string_agg(a.attname, ', ' ORDER BY array_position(con.conkey, a.attnum)),
      confrel.relname,
      string_agg(af.attname, ', ' ORDER BY array_position(con.confkey, af.attnum)),
      CASE con.confdeltype 
        WHEN 'c' THEN ' ON DELETE CASCADE' 
        WHEN 'n' THEN ' ON DELETE SET NULL' 
        ELSE '' 
      END
    )::text AS constraint_sql
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
  JOIN pg_class confrel ON confrel.oid = con.confrelid
  JOIN pg_attribute af ON af.attrelid = con.confrelid AND af.attnum = ANY(con.confkey)
  WHERE n.nspname = 'public' AND con.contype = 'f'
  GROUP BY c.relname, con.conname, confrel.relname, con.confdeltype
  ORDER BY c.relname, con.conname;
$function$;
