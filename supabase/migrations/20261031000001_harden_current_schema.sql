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
-- Faça backup e teste primeiro em um projeto Supabase separado, reconstruído
-- com schema.sql. Aplique no projeto atual somente depois de validar o teste
-- RLS e revisar os privilégios resultantes.
--
-- ALTERAÇÕES
--   1. Restringe as policies de sales_entries de PUBLIC para authenticated.
--   2. Padroniza todas as policies para (SELECT auth.uid()).
--   3. Revoga privilégios amplos e concede somente o necessário a
--      authenticated. service_role não é utilizado pelo frontend atual.
--   4. Adiciona triggers updated_at em commission_ranges e sales_entries;
--      endurece a função existente de user_settings com search_path vazio.
--   5. Define sale_date por America/Sao_Paulo.
--   6. Permite max_sales = min_sales, alinhando o CHECK ao domínio.
--   7. Remove as duas restrições redundantes de user_settings.
--
-- Esta migração preserva dados. A alteração do CHECK é segura porque a regra
-- anterior (max_sales > min_sales) já impedia registros com max < min.
-- ============================================================================

BEGIN;

-- 1. Policies: roles e expressões consistentes nas três tabelas.

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

-- 2. Privilégios mínimos: RLS não protege TRUNCATE, REFERENCES ou TRIGGER.
--    O app usa a chave anon + usuários autenticados; service_role não é
--    necessário no cliente e não recebe privilégios nessas tabelas.

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

-- 3. Função existente: search_path vazio; função interna qualificada.
--    O trigger calculae_settings_updated_at já existente continua associado.

CREATE OR REPLACE FUNCTION public.calculae_settings_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$function$;

-- 4. Novos triggers para as duas tabelas que ainda não os possuem.

DROP TRIGGER IF EXISTS calculae_commission_ranges_updated_at
  ON public.commission_ranges;
CREATE TRIGGER calculae_commission_ranges_updated_at
  BEFORE UPDATE ON public.commission_ranges
  FOR EACH ROW
  EXECUTE FUNCTION public.calculae_settings_set_updated_at();

DROP TRIGGER IF EXISTS calculae_sales_entries_updated_at
  ON public.sales_entries;
CREATE TRIGGER calculae_sales_entries_updated_at
  BEFORE UPDATE ON public.sales_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculae_settings_set_updated_at();

-- 5. Default de data alinhado ao calendário usado pelo frontend.

ALTER TABLE public.sales_entries
  ALTER COLUMN sale_date
  SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);

-- 6. Alinha a regra de limite ao domínio: min = max é uma faixa válida.

ALTER TABLE public.commission_ranges
  DROP CONSTRAINT IF EXISTS commission_ranges_max_valid;

ALTER TABLE public.commission_ranges
  ADD CONSTRAINT commission_ranges_max_valid
  CHECK (max_sales IS NULL OR max_sales >= min_sales);

-- 7. Remove apenas as duas constraints duplicadas confirmadas no inventário.

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_commission_rate_range;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_monthly_goal_nonnegative;

COMMIT;

-- Após validar em ambiente de teste, consulte role_table_grants e pg_policies.