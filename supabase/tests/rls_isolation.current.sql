-- ============================================================================
-- CalculaÊ! — teste de isolamento RLS e privilégios
-- Data: 2026-10-31
--
-- EXECUÇÃO:
--   1. Execute em um projeto Supabase SEPARADO para testes.
--   2. Aplique primeiro schema.sql ou a migração correspondente.
--   3. Tenha pelo menos duas contas de teste em auth.users.
--   4. O script seleciona duas contas sem registros nas tabelas do app.
--   5. Execute pelo SQL Editor com o papel postgres.
--
-- IMPORTANTE:
--   A transação termina com ROLLBACK. Os registros são revertidos, mas os
--   valores consumidos pela sequence identity de commission_ranges não voltam.
--   Não execute em produção.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Verifica RLS e privilégios de tabela
-- ============================================================================

DO $privilege_checks$
DECLARE
  v_table text;
  v_privilege text;
BEGIN
  -- Todas as tabelas precisam ter RLS habilitado.
  FOREACH v_table IN ARRAY ARRAY[
    'public.sales_entries',
    'public.commission_ranges',
    'public.user_settings'
  ] LOOP
    IF NOT (
      SELECT c.relrowsecurity
      FROM pg_class c
      WHERE c.oid = v_table::regclass
    ) THEN
      RAISE EXCEPTION 'FALHOU: RLS não está habilitado em %.', v_table;
    END IF;
  END LOOP;

  -- anon não deve possuir nenhum privilégio de tabela.
  FOREACH v_table IN ARRAY ARRAY[
    'public.sales_entries',
    'public.commission_ranges',
    'public.user_settings'
  ] LOOP
    FOREACH v_privilege IN ARRAY ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE',
      'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] LOOP
      IF has_table_privilege('anon', v_table, v_privilege) THEN
        RAISE EXCEPTION
          'FALHOU: anon possui % em %.', v_privilege, v_table;
      END IF;
    END LOOP;
  END LOOP;

  -- authenticated não deve possuir privilégios elevados.
  FOREACH v_table IN ARRAY ARRAY[
    'public.sales_entries',
    'public.commission_ranges',
    'public.user_settings'
  ] LOOP
    FOREACH v_privilege IN ARRAY ARRAY[
      'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] LOOP
      IF has_table_privilege('authenticated', v_table, v_privilege) THEN
        RAISE EXCEPTION
          'FALHOU: authenticated possui privilégio elevado % em %.',
          v_privilege, v_table;
      END IF;
    END LOOP;
  END LOOP;

  -- sales_entries: authenticated deve possuir CRUD.
  IF NOT has_table_privilege('authenticated', 'public.sales_entries', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.sales_entries', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.sales_entries', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.sales_entries', 'DELETE') THEN
    RAISE EXCEPTION 'FALHOU: privilégios de sales_entries incompletos.';
  END IF;

  -- commission_ranges: authenticated deve possuir CRUD.
  IF NOT has_table_privilege('authenticated', 'public.commission_ranges', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.commission_ranges', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.commission_ranges', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.commission_ranges', 'DELETE') THEN
    RAISE EXCEPTION 'FALHOU: privilégios de commission_ranges incompletos.';
  END IF;

  -- user_settings: authenticated não deve possuir DELETE.
  IF NOT has_table_privilege('authenticated', 'public.user_settings', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.user_settings', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.user_settings', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.user_settings', 'DELETE') THEN
    RAISE EXCEPTION 'FALHOU: privilégios de user_settings incorretos.';
  END IF;

  -- service_role não deve possuir privilégios diretos ou herdados nas tabelas.
  FOREACH v_table IN ARRAY ARRAY[
    'public.sales_entries',
    'public.commission_ranges',
    'public.user_settings'
  ] LOOP
    FOREACH v_privilege IN ARRAY ARRAY[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE',
      'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] LOOP
      IF has_table_privilege('service_role', v_table, v_privilege) THEN
        RAISE EXCEPTION
          'FALHOU: service_role possui % em %.', v_privilege, v_table;
      END IF;
    END LOOP;
  END LOOP;
END;
$privilege_checks$;

-- ============================================================================
-- 2. Seleciona duas contas de teste sem dados anteriores
-- ============================================================================

DO $setup$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT u.id
  INTO v_user_a
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sales_entries s WHERE s.user_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.commission_ranges c WHERE c.user_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_settings s WHERE s.user_id = u.id
  )
  ORDER BY u.created_at, u.id
  LIMIT 1;

  SELECT u.id
  INTO v_user_b
  FROM auth.users u
  WHERE u.id <> v_user_a
    AND NOT EXISTS (
      SELECT 1 FROM public.sales_entries s WHERE s.user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.commission_ranges c WHERE c.user_id = u.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_settings s WHERE s.user_id = u.id
    )
  ORDER BY u.created_at, u.id
  LIMIT 1;

  IF v_user_a IS NULL OR v_user_b IS NULL THEN
    RAISE EXCEPTION
      'FALHOU: crie pelo menos duas contas de teste sem registros nas três tabelas.';
  END IF;

  PERFORM set_config('calculae_test.user_a', v_user_a::text, true);
  PERFORM set_config('calculae_test.user_b', v_user_b::text, true);
  PERFORM set_config('calculae_test.sale_a', gen_random_uuid()::text, true);
  PERFORM set_config('calculae_test.sale_b', gen_random_uuid()::text, true);

  PERFORM set_config(
    'calculae_test.range_a',
    nextval(
      pg_get_serial_sequence(
        'public.commission_ranges', 'id'
      )::regclass
    )::text,
    true
  );

  PERFORM set_config(
    'calculae_test.range_b',
    nextval(
      pg_get_serial_sequence(
        'public.commission_ranges', 'id'
      )::regclass
    )::text,
    true
  );
END;
$setup$;

-- ============================================================================
-- 3. Insere os registros temporários como postgres
-- ============================================================================

INSERT INTO public.sales_entries (
  id, user_id, sale_date, entry_type, amount, quantity, description
)
VALUES
  (
    current_setting('calculae_test.sale_a')::uuid,
    current_setting('calculae_test.user_a')::uuid,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    'individual', 1.11, 1, 'rls-test-a'
  ),
  (
    current_setting('calculae_test.sale_b')::uuid,
    current_setting('calculae_test.user_b')::uuid,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date,
    'individual', 2.22, 1, 'rls-test-b'
  );

INSERT INTO public.commission_ranges (
  id, user_id, min_sales, max_sales, commission_rate
)
VALUES
  (
    current_setting('calculae_test.range_a')::bigint,
    current_setting('calculae_test.user_a')::uuid,
    0, NULL, 1
  ),
  (
    current_setting('calculae_test.range_b')::bigint,
    current_setting('calculae_test.user_b')::uuid,
    0, NULL, 2
  );

INSERT INTO public.user_settings (user_id, company_name)
VALUES
  (current_setting('calculae_test.user_a')::uuid, 'rls-test-a'),
  (current_setting('calculae_test.user_b')::uuid, 'rls-test-b');

-- ============================================================================
-- 4. Usuário A: acesso aos próprios dados e bloqueio dos dados de B
-- ============================================================================

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('calculae_test.user_a'),
    'role', 'authenticated'
  )::text,
  true
);

SET LOCAL ROLE authenticated;

DO $test_user_a$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.sales_entries
  WHERE id = current_setting('calculae_test.sale_a')::uuid;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não leu sua própria venda.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.sales_entries
  WHERE id = current_setting('calculae_test.sale_b')::uuid;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: A visualizou a venda de B.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.commission_ranges
  WHERE id = current_setting('calculae_test.range_a')::bigint;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não leu sua própria faixa.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.commission_ranges
  WHERE id = current_setting('calculae_test.range_b')::bigint;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: A visualizou a faixa de B.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.user_settings
  WHERE user_id = current_setting('calculae_test.user_a')::uuid;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não leu suas configurações.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.user_settings
  WHERE user_id = current_setting('calculae_test.user_b')::uuid;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: A visualizou as configurações de B.';
  END IF;

  UPDATE public.sales_entries
  SET description = 'rls-test-a-updated'
  WHERE id = current_setting('calculae_test.sale_a')::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não atualizou sua própria venda.';
  END IF;

  UPDATE public.commission_ranges
  SET commission_rate = 3
  WHERE id = current_setting('calculae_test.range_a')::bigint;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não atualizou sua própria faixa.';
  END IF;

  UPDATE public.user_settings
  SET company_name = 'rls-test-a-updated'
  WHERE user_id = current_setting('calculae_test.user_a')::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não atualizou suas configurações.';
  END IF;

  BEGIN
    UPDATE public.sales_entries
    SET user_id = current_setting('calculae_test.user_b')::uuid
    WHERE id = current_setting('calculae_test.sale_a')::uuid;

    RAISE EXCEPTION 'FALHOU: A transferiu sua venda para B.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    UPDATE public.commission_ranges
    SET user_id = current_setting('calculae_test.user_b')::uuid
    WHERE id = current_setting('calculae_test.range_a')::bigint;

    RAISE EXCEPTION 'FALHOU: A transferiu sua faixa para B.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.sales_entries (
      user_id, sale_date, entry_type, amount, quantity
    )
    VALUES (
      current_setting('calculae_test.user_b')::uuid,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date,
      'individual', 3.33, 1
    );

    RAISE EXCEPTION 'FALHOU: A criou venda em nome de B.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.commission_ranges (
      user_id, min_sales, max_sales, commission_rate
    )
    VALUES (
      current_setting('calculae_test.user_b')::uuid,
      0, NULL, 4
    );

    RAISE EXCEPTION 'FALHOU: A criou faixa em nome de B.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.user_settings
    WHERE user_id = current_setting('calculae_test.user_a')::uuid;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count <> 0 THEN
      RAISE EXCEPTION 'FALHOU: A apagou suas configurações.';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test_user_a$;

RESET ROLE;

-- ============================================================================
-- 5. Usuário B: não acessa nem altera dados de A
-- ============================================================================

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('calculae_test.user_b'),
    'role', 'authenticated'
  )::text,
  true
);

SET LOCAL ROLE authenticated;

DO $test_user_b$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.sales_entries
  WHERE id = current_setting('calculae_test.sale_b')::uuid;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: B não leu sua própria venda.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.sales_entries
  WHERE id = current_setting('calculae_test.sale_a')::uuid;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: B visualizou a venda de A.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.commission_ranges
  WHERE id = current_setting('calculae_test.range_b')::bigint;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: B não leu sua própria faixa.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.commission_ranges
  WHERE id = current_setting('calculae_test.range_a')::bigint;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: B visualizou a faixa de A.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.user_settings
  WHERE user_id = current_setting('calculae_test.user_b')::uuid;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: B não leu suas configurações.';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.user_settings
  WHERE user_id = current_setting('calculae_test.user_a')::uuid;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: B visualizou as configurações de A.';
  END IF;

  UPDATE public.sales_entries
  SET amount = 9.99
  WHERE id = current_setting('calculae_test.sale_a')::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: B alterou a venda de A.';
  END IF;

  DELETE FROM public.sales_entries
  WHERE id = current_setting('calculae_test.sale_a')::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: B apagou a venda de A.';
  END IF;

  DELETE FROM public.commission_ranges
  WHERE id = current_setting('calculae_test.range_a')::bigint;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: B apagou a faixa de A.';
  END IF;

  UPDATE public.user_settings
  SET company_name = 'invadido'
  WHERE user_id = current_setting('calculae_test.user_a')::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FALHOU: B alterou as configurações de A.';
  END IF;

  BEGIN
    UPDATE public.sales_entries
    SET user_id = current_setting('calculae_test.user_a')::uuid
    WHERE id = current_setting('calculae_test.sale_b')::uuid;

    RAISE EXCEPTION 'FALHOU: B transferiu sua venda para A.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test_user_b$;

RESET ROLE;

-- ============================================================================
-- 6. Confirma que o proprietário pode excluir seus próprios registros
-- ============================================================================

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('calculae_test.user_a'),
    'role', 'authenticated'
  )::text,
  true
);

SET LOCAL ROLE authenticated;

DO $test_owner_delete$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.sales_entries
  WHERE id = current_setting('calculae_test.sale_a')::uuid;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não excluiu sua própria venda.';
  END IF;

  DELETE FROM public.commission_ranges
  WHERE id = current_setting('calculae_test.range_a')::bigint;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FALHOU: A não excluiu sua própria faixa.';
  END IF;
END;
$test_owner_delete$;

RESET ROLE;

-- ============================================================================
-- 7. Usuário anônimo: não consegue consultar as tabelas
-- ============================================================================

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object('role', 'anon')::text,
  true
);

SET LOCAL ROLE anon;

DO $test_anon$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.sales_entries;
    RAISE EXCEPTION 'FALHOU: anon consultou sales_entries.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM count(*) FROM public.commission_ranges;
    RAISE EXCEPTION 'FALHOU: anon consultou commission_ranges.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM count(*) FROM public.user_settings;
    RAISE EXCEPTION 'FALHOU: anon consultou user_settings.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$test_anon$;

RESET ROLE;

-- ============================================================================
-- 8. Resultado
-- ============================================================================

SELECT
  'TODOS OS TESTES DE ISOLAMENTO E PRIVILÉGIOS RLS PASSARAM' AS resultado;

ROLLBACK;