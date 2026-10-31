# CalculaÊ!
### Comissão sem complicação

O CalculaÊ! é uma aplicação web desenvolvida para ajudar vendedores a acompanharem suas vendas, comissões e remuneração. A proposta é reunir em um só lugar os principais indicadores do dia a dia, facilitando o controle dos resultados e o acompanhamento das metas.

**Desenvolvido por Lavinia Mota.**

## Funcionalidades

- Cadastro, login e autenticação de usuários.
- Registro de vendas e acompanhamento dos lançamentos.
- Cálculo automático de comissões.
- Configuração de faixas e percentuais de comissão.
- Painel com indicadores de desempenho.
- Histórico de vendas e movimentações.
- Acompanhamento de metas e informações sobre remuneração.
- Configurações personalizadas.
- Recuperação e redefinição de senha.
- Interface responsiva para computadores e dispositivos móveis.
- Suporte à instalação como Progressive Web App (PWA).

## Tecnologias utilizadas

- **React:** construção da interface.
- **TypeScript:** tipagem estática e organização do código.
- **Vite:** ambiente de desenvolvimento e build.
- **Supabase:** autenticação e integração com o banco de dados.
- **PostgreSQL:** armazenamento dos dados.
- **CSS:** estilização e identidade visual.
- **Vite PWA:** recursos de instalação e experiência de aplicativo.

## Como executar o projeto

### Requisitos

- Node.js 20 ou superior.
- npm.
- Um projeto configurado no Supabase.

### Instalação

Clone o repositório e acesse a pasta do projeto:

```bash
git clone URL_DO_REPOSITORIO
cd Calculae
```

Instale as dependências:

```bash
npm install
```

### Configuração do Supabase

Na raiz do projeto, crie um arquivo chamado `.env.local`, utilizando `.env.example` como referência.

No PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Configure as variáveis com os dados do seu projeto Supabase:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica
```

A chave `anon` é destinada ao uso no frontend. A chave `service_role` não deve ser utilizada no código cliente nem publicada no repositório.

### Iniciar o ambiente de desenvolvimento

```bash
npm run dev
```

O Vite disponibilizará o endereço local para acessar a aplicação.

## Testes e validação

O projeto possui testes automatizados para regras de negócio, incluindo cálculos de comissão, datas, valores monetários e vendas.

Para executar a verificação de tipos:

```bash
npm run typecheck
```

Para executar os testes:

```bash
npm test
```

Para validar e gerar a versão de produção:

```bash
npm run build
```

Para visualizar a versão gerada localmente:

```bash
npm run preview
```

## Organização do projeto

```text
Calculae/
├── public/
│   ├── ícones e recursos da aplicação
│   └── arquivos da PWA
├── src/
│   ├── components/
│   │   └── componentes reutilizáveis
│   ├── domain/
│   │   └── regras de negócio e testes
│   ├── lib/
│   │   └── autenticação e integrações
│   ├── pages/
│   │   └── páginas da aplicação
│   ├── styles/
│   │   └── folhas de estilo
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── vite.config.ts
```

A separação entre domínio, interface e integrações ajuda a manter o código organizado e facilita a evolução do projeto.

## Banco de dados e segurança

O CalculaÊ! utiliza Supabase Auth para autenticação e PostgreSQL para persistência dos dados.

Entre as tabelas utilizadas estão:

- `sales_entries`: registros de vendas.
- `commission_ranges`: faixas de comissão.
- `user_settings`: configurações individuais.

O Row Level Security (RLS) está habilitado nessas tabelas. As políticas devem garantir que cada usuário acesse somente os registros associados à própria conta.

As credenciais de ambiente ficam fora do controle de versão. O arquivo `.env.local` não deve ser enviado ao Git.

## Publicação

A aplicação pode ser construída para produção com `npm run build` e hospedada na Vercel.

Configurações utilizadas:

- Framework: Vite.
- Build command: `npm run build`.
- Output directory: `dist`.

As variáveis de ambiente do Supabase também precisam ser cadastradas nas configurações do projeto de hospedagem.

## Autoria

**Lavinia Mota**

Projeto desenvolvido como parte da minha trajetória de estudos em Engenharia de Software