-- Authorization regression test (manual SQL):
-- A broker/member sem role gerencial NÃO deve conseguir UPDATE financeiro.
-- Expected outcome: permission denied on UPDATE em billing_payments.

BEGIN;

DO $$
DECLARE
  v_org_id uuid := '11111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '22222222-2222-2222-2222-222222222222';
  v_broker_id uuid := '33333333-3333-3333-3333-333333333333';
  v_payment_id uuid := gen_random_uuid();
BEGIN
  -- cleanup idempotente
  DELETE FROM public.user_roles WHERE user_id IN (v_admin_id, v_broker_id);
  DELETE FROM public.profiles WHERE user_id IN (v_admin_id, v_broker_id);
  DELETE FROM public.billing_payments WHERE id = v_payment_id;
  DELETE FROM public.organizations WHERE id = v_org_id;

  INSERT INTO public.organizations (id, name, slug)
  VALUES (v_org_id, 'Org RLS Teste Financeiro', 'org-rls-teste-financeiro');

  INSERT INTO public.profiles (user_id, organization_id, full_name, role)
  VALUES
    (v_admin_id, v_org_id, 'Admin Teste', 'admin'),
    (v_broker_id, v_org_id, 'Corretor Teste', 'broker');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin_id, 'admin');

  INSERT INTO public.billing_payments (
    id, organization_id, amount_cents, currency, status, provider, paid_at
  )
  VALUES (
    v_payment_id, v_org_id, 9900, 'BRL', 'paid', 'asaas', now()
  );

  -- Simula sessão autenticada do corretor (sem admin/leader/developer)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_broker_id::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  BEGIN
    UPDATE public.billing_payments
    SET amount_cents = 10900
    WHERE id = v_payment_id;

    RAISE EXCEPTION 'FALHA: corretor sem role gerencial conseguiu UPDATE financeiro';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'OK: UPDATE financeiro bloqueado para corretor sem role gerencial';
  END;

  EXECUTE 'RESET ROLE';
END
$$;

ROLLBACK;
