CREATE OR REPLACE FUNCTION public.slugify(val text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE STRICT
AS $$
  SELECT lower(regexp_replace(
    regexp_replace(
      translate(val,
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ),
    '(^-+|-+$)', '', 'g'
  ));
$$;