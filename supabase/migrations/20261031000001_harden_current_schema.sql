-- ============================================================================
-- CalculaÊ! — migração incremental para o BANCO ATUAL
-- Data: 2026-10-31
--
-- PRÉ-REQUISITOS
--   O banco já possui as tabelas commission_ranges, sales_entries e
--   user_settings, com os nomes de policies, constraints e função/trigger
--   encontrados no inventário do projeto em 31/10/2026.
--
-- NÃO é uma baseline. NÃO use em um projeto vazio.
-- Faça backup e teste primeiro em um ambiente separado que reproduza
-- o estado anterior descrito no schema.snapshot.20261031.sql.
-- O schema.sql representa o estado desejado, não o estado antigo necessário
-- para testar esta migração.
--
-- Aplique no projeto atual somente depois de validar os testes RLS,
-- revisar os privilégios resultantes e testar o funcionamento do aplicativo.
--
-- ALTERAÇÕES
--   1. Restringe as policies de sales_entries de PUBLIC para authenticated.
--   2. Padroniza todas as policies para (SELECT auth.uid()).
--   3. Revoga privilégios amplos e concede somente o necessário a
--      authenticated. service_role não recebe privilégios nessas tabelas.
--   4. Padroniza a função e os nomes dos triggers de updated_at.
--   5. Define sale_date por America/Sao_Paulo.
--   6. Permite max_sales = min_sales, alinhando o CHECK ao domínio.
--   7. Remove as duas restrições redundantes de user_settings.
--
-- Esta migração preserva dados.
-- A alteração do CHECK é segura porque a regra anterior
-- (max_sales > min_sales) já impedia registros com max < min.
--
-- IMPORTANTE:
--   Esta migração deve ser executada somente uma vez.
--   Ela utiliza os nomes dos objetos existentes no inventário de 31/10/2026.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. POLICIES: ROLES E EXPRESSÕES CONSISTENTES NAS TRÊS TABELAS
-- ============================================================================

ALTER POLICY "Users can delete own commission ranges"
  ON public.commission_ranges
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can view own commission ranges"
  ON public.commission_ranges
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can update own commission ranges"
  ON public.commission_ranges
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can insert own commission ranges"
  ON public.commission_ranges
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can insert their own sales"
  ON public.sales_entries
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can update their own sales"
  ON public.sales_entries
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can view their own sales"
  ON public.sales_entries
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can delete their own sales"
  ON public.sales_entries
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can view their own settings"
  ON public.user_settings
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can insert their own settings"
  ON public.user_settings
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Users can update their own settings"
  ON public.user_settings
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- 2. PRIVILÉGIOS MÍNIMOS
--
-- RLS não protege operações como TRUNCATE, REFERENCES ou TRIGGER.
-- O aplicativo utiliza a chave pública e usuários autenticados.
-- service_role não recebe privilégios nessas três tabelas.
-- ============================================================================

REVOKE ALL PRIVILEGES ON TABLE
  public.commission_ranges,
  public.sales_entries,
  public.user_settings
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_ranges, public.sales_entries
  TO authenticated;

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.user_settings
  TO authenticated;

-- ============================================================================
-- 3. PADRONIZAÇÃO DA FUNÇÃO E DO TRIGGER EXISTENTES
--
-- O banco atual possui:
--   public.calculae_settings_set_updated_at()
--   calculae_settings_updated_at em user_settings
--
-- O schema.sql utiliza:
--   public.calculae_set_updated_at()
--   user_settings_updated_at
--
-- O PostgreSQL mantém o vínculo interno do trigger com a função
-- mesmo quando o nome da função é alterado.
-- ============================================================================

ALTER FUNCTION public.calculae_settings_set_updated_at()
  RENAME TO calculae_set_updated_at;

ALTER TRIGGER calculae_settings_updated_at
  ON public.user_settings
  RENAME TO user_settings_updated_at;

CREATE OR REPLACE FUNCTION public.calculae_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 4. CRIAÇÃO DOS TRIGGERS NAS OUTRAS DUAS TABELAS
-- ============================================================================

CREATE TRIGGER commission_ranges_updated_at
  BEFORE UPDATE ON public.commission_ranges
  FOR EACH ROW
  EXECUTE FUNCTION public.calculae_set_updated_at();

CREATE TRIGGER sales_entries_updated_at
  BEFORE UPDATE ON public.sales_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculae_set_updated_at();

-- ============================================================================
-- 5. DEFAULT DE DATA ALINHADO AO CALENDÁRIO DO FRONTEND
-- ============================================================================

ALTER TABLE public.sales_entries
  ALTER COLUMN sale_date
  SET DEFAULT (
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  );

-- ============================================================================
-- 6. REGRA DE LIMITE DAS FAIXAS
-- min_sales = max_sales é uma faixa válida.
-- ============================================================================

ALTER TABLE public.commission_ranges
  DROP CONSTRAINT IF EXISTS commission_ranges_max_valid;

ALTER TABLE public.commission_ranges
  ADD CONSTRAINT commission_ranges_max_valid
  CHECK (max_sales IS NULL OR max_sales >= min_sales);

-- ============================================================================
-- 7. REMOÇÃO DAS CONSTRAINTS REDUNDANTES
-- ============================================================================

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_commission_rate_range;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_monthly_goal_nonnegative;

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================

COMMIT;

-- Após validar em ambiente de teste, consulte:
--   information_schema.role_table_grants
--   pg_policies
--   information_schema.triggers