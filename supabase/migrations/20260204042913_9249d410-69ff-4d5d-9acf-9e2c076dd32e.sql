-- Primeiro: adicionar apenas o constraint UNIQUE
ALTER TABLE public.property_images 
ADD CONSTRAINT property_images_property_id_url_unique 
UNIQUE (property_id, url);