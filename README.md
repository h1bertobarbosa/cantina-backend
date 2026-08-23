# **Cantina Backend**

## **Descrição**

O **Cantina Backend** é uma aplicação server-side desenvolvida para gerenciar as operações de uma cantina(pequeno comercio). O sistema oferece funcionalidades para controlar vendas inclusive a receber, gerando faturas, clientes e produtos, facilitando a gestão diária e aprimorando a eficiência operacional.

## **Características Principais**

- **Gerenciamento de Vendas:** Controle completo das transações realizadas na cantina.
- **Faturamento:** Emissão e gerenciamento de faturas para clientes.
- **Gestão de Clientes:** Cadastro e acompanhamento de informações dos clientes.
- **Catálogo de Produtos:** Administração dos produtos disponíveis para venda.
- **Autenticação:** Sistema seguro de login.

## **Pré-requisitos**

Antes de começar, certifique-se de ter instalado em sua máquina:

- **Node.js** (versão 20 ou superior)
- **npm**
- **PostgreSQL**
- **Docker**

## Configuração do Banco de Dados

Copiar no arquivo .env.example
´DATABASE_URL=postgres://cantina:123456@localhost:5432/cantina´
colar no terminal
´export DATABASE_URL=postgres://cantina:123456@localhost:5432/cantina´
subir o banco de dados com o comando docker
´docker compose up -d db´
ainda no terminal rodar os comandos para criar as tabelas
´npm run migrate up´

As migrations usam [dbmate](https://github.com/amacneil/dbmate) e ficam em `migrations/` (arquivos `.sql` com blocos `-- migrate:up` / `-- migrate:down`). Comandos úteis:

```bash
npm run migrate up       # aplica migrations pendentes
npm run migrate down     # reverte a última migration
npm run migrate new <nome>  # cria uma nova migration em migrations/
npm run migrate status   # lista o que já foi aplicado
```

### Migrando de node-pg-migrate para dbmate em um ambiente já existente

Bancos que já tinham o schema criado pelo antigo `node-pg-migrate` (ex.: produção) têm as tabelas mas não a tabela de controle `schema_migrations` do dbmate. Rodar `dbmate up` direto tentaria recriar as tabelas e falharia. Faça isso uma única vez, por ambiente:

1. Rode `dbmate up` — ele cria a tabela `schema_migrations` e falha ao tentar aplicar a primeira migration (esperado, pode ignorar o erro).
2. Marque como já aplicadas todas as migrations que correspondem ao schema já existente:
   ```sql
   INSERT INTO schema_migrations (version) VALUES
     ('20240810010210'),
     ('20240810225346'),
     ('20240810225938'),
     ('20240810230108'),
     ('20240905161016'),
     ('20240905161017'),
     ('20240905161107'),
     ('20250321173722'),
     ('20250511002054'),
     ('20250913151726');
   ```
3. `npm run migrate status` deve mostrar tudo aplicado. A partir daí, `npm run migrate up` só roda migrations novas.

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
