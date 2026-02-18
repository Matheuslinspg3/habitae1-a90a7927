
-- Drop the trigger and function that creates marketplace notifications
DROP TRIGGER IF EXISTS trg_notify_new_marketplace_property ON public.marketplace_properties;
DROP FUNCTION IF EXISTS public.notify_new_marketplace_property();

-- Delete all existing marketplace notifications
DELETE FROM public.notifications WHERE type = 'new_marketplace_property';
