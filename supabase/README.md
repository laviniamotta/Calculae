# Supabase — CalculaÊ!

Esta pasta reúne a estrutura do banco de dados PostgreSQL utilizado pelo CalculaÊ!, as migrações e os testes de segurança.

Os arquivos possuem finalidades distintas. **Nenhum SQL deve ser executado no banco de produção sem backup e sem seguir o procedimento de validação descrito neste documento.**

## 1. Estrutura de arquivos

| Arquivo | Finalidade | Onde utilizar |
|---|---|---|
| `schema.snapshot.20261031.sql` | Registro da estrutura encontrada no banco em 31/10/2026, reconstruído a partir do inventário do catálogo PostgreSQL. | Somente referência. Não executar. |
| `schema.sql` | Baseline corrigida para criação de um banco novo e vazio. | Projeto Supabase novo ou ambiente de teste. |
| `migrations/20261031000001_harden_current_schema.sql` | Migração incremental para atualizar o banco existente. | Primeiro em ambiente de teste e, após validação, no banco atual. |
| `tests/rls_isolation.current.sql` | Testes de isolamento entre usuários e de privilégios de tabela. | Ambiente de teste, com o papel `postgres`. |

Os arquivos SQL da arquitetura anterior foram removidos dos diretórios operacionais por serem incompatíveis com a estrutura atual do banco.

## 2. Estrutura atual do banco

O CalculaÊ! utiliza três tabelas no schema `public`:

### `sales_entries`

Armazena os registros de vendas.

Principais campos:

- `id`: identificador UUID.
- `user_id`: usuário proprietário do registro.
- `sale_date`: data da venda.
- `entry_type`: tipo do registro (`individual` ou `daily_total`).
- `amount`: valor monetário.
- `quantity`: quantidade.
- `description`: descrição opcional.
- `created_at` e `updated_at`: controle de criação e atualização.

### `commission_ranges`

Armazena as faixas de faturamento e os respectivos percentuais de comissão.

Principais campos:

- `id`: identificador.
- `user_id`: usuário proprietário.
- `min_sales`: limite mínimo.
- `max_sales`: limite máximo, podendo ser nulo para uma faixa sem limite superior.
- `commission_rate`: percentual de comissão.
- `created_at` e `updated_at`: controle de criação e atualização.

### `user_settings`

Armazena as configurações e informações profissionais do usuário.

Inclui dados como:

- Empresa e nome profissional.
- Cargo e data de admissão.
- Salário-base e benefícios.
- Descontos fixos.
- Meta mensal e percentual de comissão.
- Configurações de férias.
- Moeda utilizada.
- Observações.

As três tabelas possuem relacionamento com `auth.users`, com exclusão em cascata quando uma conta é removida.

## 3. Revisão de segurança

A revisão busca reduzir privilégios desnecessários, padronizar as políticas de acesso e reforçar a integridade dos registros.

### Row Level Security (RLS)

As três tabelas possuem RLS habilitado.

As policies restringem o acesso aos registros de acordo com o usuário autenticado, utilizando `auth.uid()`.

As policies de `sales_entries`, anteriormente atribuídas a `PUBLIC`, passam a ser exclusivas de `authenticated`.

As expressões utilizam `(SELECT auth.uid())`, permitindo que o PostgreSQL otimize a avaliação da identidade do usuário durante a consulta.

### Matriz de privilégios

| Operação | `anon` | `authenticated` | `service_role` |
|---|---:|---:|---:|
| SELECT | Não | Sim | Não |
| INSERT | Não | Sim | Não |
| UPDATE | Não | Sim | Não |
| DELETE em `sales_entries` | Não | Sim | Não |
| DELETE em `commission_ranges` | Não | Sim | Não |
| DELETE em `user_settings` | Não | Não | Não |
| TRUNCATE | Não | Não | Não |
| REFERENCES | Não | Não | Não |
| TRIGGER | Não | Não | Não |

As permissões efetivas também dependem das policies de RLS.

**O `service_role` não recebe privilégios nessas três tabelas.** Essa decisão considera que o aplicativo atual utiliza a chave pública do Supabase e não depende de operações administrativas com a chave de serviço.

Caso funcionalidades administrativas ou scripts de servidor precisem utilizar `service_role` no futuro, os privilégios deverão ser avaliados e concedidos explicitamente.

A chave `service_role` nunca deve ser exposta no frontend.

### Atualização de `updated_at`

As três tabelas possuem triggers responsáveis pela atualização automática de `updated_at`.

A função utilizada é:

`public.calculae_set_updated_at()`

Ela utiliza `search_path` vazio e qualifica a função interna `pg_catalog.now()`, reduzindo riscos de resolução indevida de objetos.

Os nomes da função e dos triggers são padronizados entre a baseline e o banco migrado.

### Data das vendas

O valor padrão de `sale_date` utiliza o calendário de `America/Sao_Paulo`, evitando divergências de data decorrentes do fuso horário do servidor.

### Integridade das faixas

A constraint de `commission_ranges` permite que `max_sales` seja igual a `min_sales`, além de aceitar `NULL` como limite superior sem restrição.

Essa regra acompanha a validação de faixas da aplicação.

A continuidade e a organização das faixas também são responsabilidades da validação de domínio no frontend.

### Restrições duplicadas

Duas constraints redundantes de `user_settings` são removidas pela migração:

- `user_settings_commission_rate_range`
- `user_settings_monthly_goal_nonnegative`

As validações equivalentes permanecem nas constraints principais.

## 4. Diferença entre baseline, snapshot e migração

É importante não confundir os três arquivos.

### `schema.snapshot.20261031.sql`

Representa o estado observado no banco em 31/10/2026, antes da aplicação das alterações propostas.

Foi reconstruído a partir da inspeção do catálogo PostgreSQL. **Não é um dump bruto gerado pelo `pg_dump`** e não deve ser executado como migração.

### `schema.sql`

Representa a estrutura desejada para um projeto Supabase novo e vazio.

Já incorpora as alterações propostas de segurança, privilégios, triggers, policies e constraints.

Não deve ser executado sobre o banco atual, pois as tabelas já existem.

### `migrations/20261031000001_harden_current_schema.sql`

É uma migração incremental destinada ao banco existente.

Parte dos objetos identificados no inventário de 31/10/2026 e aplica as alterações necessárias para aproximar sua estrutura da baseline atualizada.

Ela utiliza uma transação para que as alterações sejam revertidas em caso de falha.

Não é idempotente e não deve ser executada repetidamente.

## 5. Pressupostos da migração

A migração depende da existência dos seguintes objetos no banco atual:

- Policies das três tabelas com os nomes registrados no snapshot.
- Constraint `commission_ranges_max_valid`.
- Constraint `user_settings_commission_rate_range`.
- Constraint `user_settings_monthly_goal_nonnegative`.
- Função `public.calculae_settings_set_updated_at()`.
- Trigger `calculae_settings_updated_at` na tabela `user_settings`.

A função e o trigger existentes são renomeados para os nomes padronizados. Os novos triggers são criados nas outras duas tabelas.

Antes de executar a migração, confirme que o banco corresponde a esses pressupostos. Se houver divergência estrutural, a migração deverá ser adaptada.

## 6. Testes de segurança — RLS

O arquivo `tests/rls_isolation.current.sql` verifica:

- RLS habilitado nas três tabelas.
- Privilégios de `anon`, `authenticated` e `service_role`.
- Acesso de cada usuário aos próprios registros.
- Bloqueio de leitura de registros pertencentes a outro usuário.
- Bloqueio de atualização e exclusão de registros de terceiros.
- Bloqueio de inserção de registros em nome de outro usuário.
- Bloqueio de alteração da propriedade de registros.
- Permissão de exclusão dos próprios registros quando aplicável.
- Ausência de permissão de exclusão em `user_settings`.
- Bloqueio de consultas realizadas pelo usuário anônimo.

O teste exige pelo menos duas contas em `auth.users` sem registros anteriores nas três tabelas.

Deve ser executado pelo SQL Editor com o papel `postgres`, em um ambiente de teste.

O script abre uma transação e termina com `ROLLBACK`. Os registros temporários são revertidos, mas os valores consumidos pela sequence identity de `commission_ranges` não são restaurados.

## 7. Ordem de validação

A validação da baseline e a validação da migração são processos diferentes.

### Baseline — projeto novo

1. Criar um projeto Supabase separado para testes.
2. Criar pelo menos duas contas descartáveis.
3. Aplicar `schema.sql` pelo SQL Editor, com o papel `postgres`.
4. Executar `tests/rls_isolation.current.sql`.
5. Confirmar que todos os testes passaram.
6. Apontar uma cópia local do aplicativo para o projeto de teste.
7. Validar cadastro, login, vendas, histórico, comissões, configurações e painel.

### Migração — estrutura existente

1. Fazer backup do banco atual.
2. Preparar um ambiente de teste que reproduza a estrutura anterior descrita no snapshot.
3. Aplicar a migração incremental nesse ambiente.
4. Conferir policies, constraints, triggers e privilégios.
5. Executar os testes de isolamento.
6. Validar o funcionamento do aplicativo.
7. Avaliar a aplicação no banco de produção somente após a aprovação das verificações.

**Não aplique `schema.sql` no banco existente.** Para o banco atual, o arquivo correspondente é a migração incremental.

## 8. Verificação de privilégios

Após aplicar as alterações no ambiente de teste, consulte os privilégios efetivos registrados pelo PostgreSQL:

```sql
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'commission_ranges',
    'sales_entries',
    'user_settings'
  )
ORDER BY
  table_name,
  grantee,
  privilege_type;
```

Para conferir as policies:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Para conferir os triggers:

```sql
SELECT
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'commission_ranges',
    'sales_entries',
    'user_settings'
  )
ORDER BY event_object_table, trigger_name;
```

## 9. Cuidados com credenciais

- Não versionar `.env.local`.
- Não publicar chaves secretas.
- Utilizar somente a chave pública apropriada no frontend.
- Nunca colocar a chave `service_role` em código executado no navegador.
- Não compartilhar arquivos ZIP contendo credenciais, dependências ou artefatos de build desnecessários.

## 10. Estado da validação

Os arquivos foram preparados e revisados estaticamente. Isso não significa que a migração ou os testes já tenham sido executados em PostgreSQL.

- [ ] `schema.sql` aplicado em projeto de teste sem erros.
- [ ] Teste `rls_isolation.current.sql` concluído com sucesso.
- [ ] Aplicativo validado de ponta a ponta no projeto de teste.
- [ ] Migração incremental testada em uma reprodução do banco atual.
- [ ] Privilégios e policies conferidos após a migração.
- [ ] Backup do banco de produção realizado.
- [ ] Migração aplicada em produção.
- [ ] Aplicação validada após a migração.

**Estado atual:** os arquivos SQL ainda não foram executados no banco de produção. A validação em ambiente PostgreSQL continua pendente.