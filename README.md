 <div align="center">

# CalculaÊ!

### Comissão sem complicação

Aplicação web (PWA) para vendedores acompanharem vendas, comissões e remuneração em um só lugar.

[**Acessar o aplicativo**](https://SEU-APP.vercel.app) · [LinkedIn](https://www.linkedin.com/in/laviniamota/) · [GitHub](https://github.com/laviniamotta)

<!-- PREENCHER: substitua o endereço acima pelo endereço real da Vercel após a publicação. -->

</div>

---

## Visão geral

<!-- ADICIONAR: 2 ou 3 imagens (painel, comissões e versão no celular), utilizando uma conta fictícia.
     Exemplo: ![Painel](assets/painel.png)
     As imagens podem ser salvas na pasta /assets/, evitando a pasta /docs/, que está no .gitignore. -->

Quem vive de comissão costuma descobrir quanto vai receber só no fim do mês, depois de refazer contas à mão. O CalculaÊ! resolve isso: o vendedor registra as vendas ao longo do dia, define suas faixas de comissão e acompanha, em tempo real, em que faixa está, quanto falta para a próxima e qual é a estimativa de ganho.

O projeto foi construído como parte da minha formação em Engenharia de Software, com atenção especial a um ponto em que aplicações financeiras costumam falhar: **a precisão dos cálculos**.

## Funcionalidades

- Cadastro, login e recuperação/redefinição de senha.
- Registro de vendas, com histórico para consultar, editar e excluir lançamentos.
- Faixas de comissão configuráveis, com a estimativa calculada automaticamente.
- Painel com faturamento do dia e do mês, faixa atual, valor que falta para a próxima faixa e progresso da meta mensal.
- Configurações de meta mensal, salário-base, auxílio-transporte, outros benefícios, descontos fixos e moeda.
- Tema claro, escuro ou do sistema.
- Interface responsiva e instalável como aplicativo (PWA), com aviso quando há uma nova versão.

## Decisões técnicas

Estas são as escolhas que mais influenciam a confiabilidade do projeto:

- **Dinheiro em centavos inteiros.** Evita os erros de ponto flutuante (`0,1 + 0,2 ≠ 0,3`). Os valores só viram "reais" na hora de exibir.
- **Taxas em pontos-base.** 1,5% equivale a 150 bps. O cálculo usa apenas inteiros e arredonda uma única vez, com regra definida (meio para cima) e coberta por testes.
- **Faixas fechadas e contínuas.** Uma faixa de "R$ 0,00 a R$ 999,99" é seguida por outra que começa em R$ 1.000,00. Não há sobreposição nem lacuna, e a última faixa é sempre "em diante".
- **Uma única validação.** A mesma função do domínio valida as faixas ao salvar e ao calcular, então a tela não aceita uma configuração que o cálculo rejeitaria.
- **Datas de calendário no fuso de São Paulo.** O "dia" de uma venda não muda conforme o fuso do aparelho do usuário.
- **Erros controlados.** Uma configuração inválida mostra uma mensagem clara no lugar da estimativa, em vez de quebrar a tela. Um Error Boundary protege as páginas contra falhas inesperadas de renderização.
- **PWA sem cache de dados.** Apenas o "casco" do aplicativo (HTML, JS, CSS e ícones) fica em cache. As respostas do Supabase não são guardadas pelo service worker, para evitar a apresentação de vendas desatualizadas.
- **Domínio independente da interface.** As regras de negócio ficam em `src/domain/`, sem depender de React nem do Supabase, o que as torna fáceis de testar.

### Regras de comissão

Hoje a interface trabalha com **faixas de faturamento em que a taxa da faixa atingida vale para todo o faturamento do mês**. A camada de domínio já suporta outros modelos, prontos para chegar à interface:

| Modelo | Como funciona |
| --- | --- |
| Percentual simples | Uma taxa única sobre o faturamento |
| Faixas, base total | A taxa da faixa atingida vale para todo o faturamento |
| Faixas, base por parcela | Cada faixa se aplica só à parcela do faturamento dentro dela |
| Valor fixo por faixa | Um valor fixo conforme a faixa de faturamento |
| Valor por venda | Um valor fixo multiplicado pela quantidade de vendas |
| Faixas por quantidade | Um valor fixo conforme o número de vendas |

Além disso, o domínio permite **versões de regra com vigência**: uma regra nova só vale a partir do próximo período, e períodos passados não mudam.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | React 18, TypeScript (modo estrito), React Router |
| Build | Vite |
| Autenticação e dados | Supabase (Auth + PostgreSQL) |
| PWA | vite-plugin-pwa |
| Testes | Test runner nativo do Node, executado com `tsx` |
| Hospedagem planejada | Vercel |

## Arquitetura

```text
src/
├── domain/       Regras de negócio puras (dinheiro, datas, faixas, comissão, vendas) e seus testes
├── lib/          Integrações e adaptadores (Supabase, autenticação, tema, cálculo para as telas)
├── components/   Componentes reutilizáveis (estrutura da aplicação, rotas protegidas, tema)
├── pages/        Páginas da aplicação
└── styles/       Folhas de estilo
```

O fluxo é: **páginas** leem os dados do Supabase, passam por `lib/commission.ts` (que converte para centavos e pontos-base) e chamam o **domínio**, onde ficam as regras e as validações.

## Segurança

- **Row Level Security (RLS)** habilitado nas tabelas `sales_entries`, `commission_ranges` e `user_settings`, com políticas que limitam cada usuário aos próprios registros.
- O snapshot da estrutura atual do banco está documentado em [`supabase/schema.snapshot.20261031.sql`](supabase/schema.snapshot.20261031.sql).
- A referência para novos ambientes está em [`supabase/schema.sql`](supabase/schema.sql). Ela não deve ser executada sobre o banco atual.
- A migração incremental de segurança está em [`supabase/migrations/20261031000001_harden_current_schema.sql`](supabase/migrations/20261031000001_harden_current_schema.sql) e ainda precisa ser validada em ambiente de teste.
- Os procedimentos e diferenças entre as estruturas estão descritos em [`supabase/README.md`](supabase/README.md).
- O teste de isolamento entre usuários está em [`supabase/tests/rls_isolation.current.sql`](supabase/tests/rls_isolation.current.sql). Sua execução em ambiente separado ainda é necessária para confirmar o comportamento esperado.
- Somente a chave pública `anon` é usada no frontend. A chave `service_role` nunca deve entrar no código do navegador nem no repositório.
- Variáveis de ambiente ficam fora do controle de versão (`.env.local` está no `.gitignore`).

O projeto utiliza políticas RLS para restringir o acesso aos dados de cada usuário. As alterações recentes no schema e nas políticas estão em processo de revisão e validação antes da aplicação em produção.

## Como executar localmente

### Requisitos

- Node.js 20 ou superior e npm.
- Um projeto no [Supabase](https://supabase.com).

### Passo a passo

1. Clone o repositório e instale as dependências:

   ```bash
   git clone https://github.com/laviniamotta/Calculae.git
   cd Calculae
   npm install
   ```

2. Configure um projeto Supabase de teste. Consulte [`supabase/README.md`](supabase/README.md) antes de utilizar os arquivos SQL. O `schema.sql` é destinado a um projeto novo e vazio.

3. Crie o arquivo `.env.local` a partir do exemplo:

   ```bash
   cp .env.example .env.local
   ```

   No PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Preencha as variáveis com os dados de **Project Settings → API**:

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
   ```

5. Inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run typecheck` | Verifica os tipos com o TypeScript |
| `npm test` | Executa os testes automatizados |
| `npm run build` | Verifica os tipos e gera a versão de produção |
| `npm run preview` | Serve localmente a versão gerada |

## Testes

Os testes cobrem as regras de negócio, que são a parte mais sensível do projeto:

- dinheiro: leitura e formatação em reais, arredondamento em centavos;
- datas: validação, mudança de mês e de ano e fuso de São Paulo;
- faixas: sobreposição, lacunas, limites e última faixa "em diante";
- comissão: modelos de regra, vigência e proteção de períodos passados;
- vendas: soma diária, melhor dia e contagem de vendas;
- camada de integração: seleção de faixa, cálculo com arredondamento e retorno de erro controlado para configurações inválidas.

## Publicação na Vercel

O projeto ainda está em preparação para publicação.

Após a implantação:

1. Importe o repositório na [Vercel](https://vercel.com).
2. Configure as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em **Settings → Environment Variables**.
3. No Supabase, em **Authentication → URL Configuration**, informe o endereço da Vercel em *Site URL* e em *Redirect URLs*. Sem isso, os links de confirmação de e-mail e recuperação de senha podem apontar para o endereço errado.

## Demonstração

A demonstração pública será disponibilizada após a publicação e validação do aplicativo.

<!-- PREENCHER: escolher uma conta de teste com dados fictícios ou disponibilizar o cadastro aberto. Não publicar credenciais reais. -->

## Próximos passos

Ideias de evolução, em ordem aproximada de prioridade:

- Levar à interface os outros modelos de comissão que o domínio já suporta (por parcela, valor fixo, por venda e por quantidade) e as versões de regra com vigência.
- Exportação do relatório do período em PDF.
- Testes de interface e automação de testes e build a cada push (GitHub Actions).
- Salário líquido estimado, somando comissão, benefícios e descontos.

## Autoria

Desenvolvido por **Lavinia Mota**, como parte da minha trajetória de estudos em Engenharia de Software.

- LinkedIn: [linkedin.com/in/laviniamota](https://www.linkedin.com/in/laviniamota/)
- GitHub: [github.com/laviniamotta](https://github.com/laviniamotta)

## Direitos autorais

© 2026 Lavinia Mota. Todos os direitos reservados.