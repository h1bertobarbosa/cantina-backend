# AGENTS.md — Diretrizes para Agentes de IA e Desenvolvedores

## 1. Visão Geral

- **Linguagem:** TypeScript (target ES2021, `strictNullChecks`/`noImplicitAny` desligados — ver `tsconfig.json`)
- **Runtime:** Node.js 20+
- **Framework principal:** NestJS 10 (Express platform), build via `@swc/core` (`nest-cli.json` builder: `swc`)
- **Persistência:** PostgreSQL via driver `pg` puro (**sem ORM**). Migrations com `dbmate` (`migrations/`)
- **Auth:** JWT (`@nestjs/jwt`) com guard global + decorator `@Public()`
- **Testes:** Jest (unitário, `@swc/jest`) + Jest/ts-jest (e2e)
- **Arquitetura:** Monólito modular por feature (`src/<feature>/`), inspirado em Nest's module/controller/service, com tentativas pontuais e inconsistentes de Ports & Adapters (repository interfaces) e Domain Entities ricas.

Resumo: cada feature é um `NestModule` próprio (controller + service + DTOs + entities). Regras de negócio ficam majoritariamente nos `*.service.ts` e em serviços de orquestração dedicados (`new-sale.service.ts`, `pay-billing.service.ts`, `billing.facade.ts`), que acessam o Postgres **diretamente via SQL** (não há uma camada de repositório consistente). Multi-tenancy é feita por `account_id` em toda tabela e reforçada em cada service.

> Este documento é o resumo operacional. Para regras detalhadas de um assunto específico (API HTTP, Postgres/SQL, testes), carregue sob demanda os arquivos listados na seção 12 — não é necessário lê-los para toda alteração.

## 2. Mapa do Repositório

| Caminho | Responsabilidade |
| --- | --- |
| `src/main.ts` | Bootstrap: CORS, `ValidationPipe` global, `HttpExceptionFilter` global, Swagger em `/swagger` |
| `src/app.module.ts` | Módulo raiz — registra `ConfigModule`, `PostgresModule.forRoot`, e todos os módulos de feature |
| `src/postgres/` | `PostgresModule` (global, `forRoot(config)`) e `PostgresService.query<T>(sql, params)` — único ponto de acesso ao Postgres |
| `src/signin/` | Login (JWT), `AuthGuard` global (registrado como `APP_GUARD`? — ver nota abaixo), `@Public()`, `@User()` decorator |
| `src/signup/` | Cadastro de conta+usuário — **único lugar que usa transação SQL explícita** (`BEGIN`/`COMMIT`) |
| `src/users/`, `src/clients/`, `src/products/` | CRUD por feature, SQL inline no service, DTOs de input/output |
| `src/sales/` | Registro de vendas (`new-sale.service.ts`), leitura/listagem (`sales.service.ts`), repositório parcial (`repository/`) |
| `src/billings/` | Faturas de clientes: `billings.service.ts` (leitura), `pay-billing.service.ts` + `facades/billing.facade.ts` (orquestração de pagamento) |
| `src/transactions/` | Entidade `Transaction` rica + `TransactionsRepository` (interface/porta) + `PgTransactionsRepository` (adapter) — módulo mais próximo de um padrão "correto" de repositório |
| `src/dashboard/` | Endpoints agregados (somas/consultas para relatórios) |
| `src/libs/` | Providers cross-cutting injetáveis por interface: `GUID_PROVIDER` (UUIDv7) e `HASHING_PROVIDER` (bcrypt) |
| `src/logger/` | `LOGGER` token → `WinstonLogger` (Winston + daily-rotate-file) |
| `src/filters/`, `src/exceptions/` | `HttpExceptionFilter` global e `ValidationException` (pouco usada — ver anti-padrões) |
| `migrations/` | Migrations `dbmate` (SQL puro), nomeadas `<timestamp de 14 dígitos>_<descrição-kebab>.sql` com blocos `-- migrate:up`/`-- migrate:down` |
| `test/` | E2E Jest (`test/jest-e2e.json`) — hoje contém apenas o boilerplate `app.e2e-spec.ts` |

## 3. Fluxo Arquitetural

Fluxo dominante:

```
HTTP → Controller (@Controller) → Service/Facade (SQL inline via PostgresService) → Postgres
```

Onde existe, um fluxo mais desacoplado aparece em `sales`/`transactions`/`billings`:

```
Controller → Service de orquestração (ex: NewSaleService) → *Repository (interface via DI token)
                                                            → PostgresService.query (SQL direto, ainda majoritário)
```

Regras observadas:

- **Multi-tenancy obrigatória:** toda entidade tem `account_id`. Toda query de leitura por `id` deve validar `row.account_id !== accountId` e lançar `NotFoundException` se divergir (ex.: `src/users/users.service.ts:106-115`, `src/sales/sales.service.ts:130-133`, `src/sales/new-sale.service.ts:196-205`). Nunca confie apenas no `WHERE account_id = $1` — o padrão do projeto é buscar por `id` e checar o `account_id` do resultado.
- `@User() user: UserSession` (`src/signin/decorators/user.decorator.ts`) injeta o payload do JWT (`sub`, `accountId`, `email`, `name`) em qualquer handler; o `accountId` do usuário autenticado é sempre repassado manualmente ao DTO/service — nunca confiar em `accountId` vindo do body/query do cliente.
- Autenticação é global por padrão: `AuthGuard` é registrado como `APP_GUARD` dentro de `src/signin/signin.module.ts:24-25` (não em `app.module.ts`), então toda rota de qualquer módulo exige JWT válido a menos que marcada com `@Public()` (`src/signin/decorators/public.decorator.ts`).
- Dependências entre módulos fluem de feature → `libs`/`postgres`/`logger`/`transactions` (import explícito do módulo). `transactions` é importado por `sales` e `billings` como dependência compartilhada — não crie import reverso (`transactions` não deve depender de `sales`/`billings`).

## 4. Convenções de Código

### Nomenclatura
- Arquivos: `kebab-case.tipo.ts` (`create-user.dto.ts`, `pg-sale.repository.ts`, `billing-item-type.vo.ts`).
- Classes/Interfaces: `PascalCase`; DTOs terminam em `Dto` (`CreateUserDto`, `OutputUserDto`); Value Objects em `.vo.ts` (`TransactionPaymentMethod`, `BillingItemTypeEnum`).
- Tokens de injeção por interface: `UPPER_SNAKE_CASE` `Symbol` exportado junto da interface no mesmo arquivo (`GUID_PROVIDER`, `HASHING_PROVIDER`, `TRANSACTIONS_REPOSITORY`, `SALES_REPOSITORY`).
- Tabelas/colunas SQL: `snake_case` (`account_id`, `created_at`, `payed_at`). Interfaces "table shape" (o retorno cru do `pg`) são nomeadas `<Entidade>Table` (`UsersTable`, `ProductTable`, `TransactionTable`, `BillingsTable`) e mantêm os campos em `snake_case`.

### Organização de arquivos
- Cada feature em `src/<feature>/` com subpastas `dto/`, `entities/`, e opcionalmente `repository/ports` + `repository/adapter` (ou `.../repository/` plano — inconsistente, ver seção 6).
- DTOs de entrada (`create-*.dto.ts`, `update-*.dto.ts`, `query-*.dto.ts`) usam `class-validator` + `@ApiProperty()`/`@ApiPropertyOptional()`.
- DTOs de saída (`output-*.dto.ts`) são classes com construtor que mapeia `snake_case` → `camelCase` e um factory estático `static fromTable(row: XTable)` (ex.: `src/users/dto/output-user.dto.ts`, `src/billings/dto/output-billing.dto.ts`).
- Entidades de domínio "ricas" (quando existem) têm construtor **privado**, factories estáticos `getInstance()`/`fromData()`, e só expõem getters/poucos setters (`src/transactions/entities/transaction.entity.ts`, `src/billings/entities/billing.entity.ts`, `src/products/entities/product.entity.ts`). Nunca exponha campos públicos mutáveis nessas entidades.

### Imports e dependências
- Imports internos usam alias `src/...` (baseUrl `./`), ex.: `import { PostgresService } from 'src/postgres/postgres.service'`. Dentro do próprio módulo, prefira relativo (`../ports/billint-table.interface`).
- Providers com múltiplas implementações são registrados por token no `@Module` (`{ provide: TOKEN, useClass: Impl }`) e injetados com `@Inject(TOKEN)` — nunca injete a classe concreta de um repositório/adapter diretamente quando um token existir.

### Validação
- Toda validação de payload HTTP é feita via `class-validator` nos DTOs de entrada + `ValidationPipe({ transform: true, whitelist: true })` global (`src/main.ts:14`). Não reimplemente validação manual de formato dentro do service.
- Filtros de ordenação (`orderBy`) usados em SQL dinâmico **devem** passar por uma whitelist (`Record<string, string>`) antes de entrar na query, nunca interpolar `orderBy` do usuário diretamente — padrão consolidado em `SALES_ORDER_BY_COLUMNS` (`src/sales/sales.service.ts:12-19`) e `USERS_ORDER_BY_COLUMNS` (`src/users/users.service.ts:31-36`).
- Paginação (`page`/`perPage`) tem defaults aplicados no construtor do Query DTO (`src/users/dto/query-user.dto.ts:24-30`), não no service.

### Erros
- Use as exceções HTTP nativas do Nest (`NotFoundException`, `BadRequestException`, `UnauthorizedException`) lançadas diretamente no service — é o padrão dominante em todos os módulos.
- Existe um `HttpExceptionFilter` global (`src/filters/http-exception.filter.ts`) que formata toda resposta de erro como `{ statusCode, timestamp, path, method, message }`. Não crie outro filtro de exceção paralelo.
- `src/exceptions/validation.exception.ts` (`ValidationException`) existe mas **não determinado com confiança** que esteja em uso ativo — não foi encontrada referência clara nos services revisados. Antes de reutilizá-la, confirme com `grep -rn ValidationException src`; prefira as exceções nativas do Nest, que são o padrão comprovado.

### Logging
- Existem **dois mecanismos de log coexistindo** — ver anti-padrão na seção 6. Para código novo, prefira o logger injetado via `LOGGER` token (Winston) como em `src/sales/new-sale.service.ts` (`@Inject(LOGGER) private readonly logger: LoggerService`), não `Logger.log(...)` estático do Nest.

### Persistência
- Único ponto de acesso ao banco: `PostgresService.query<T>(sql, params)` (`src/postgres/postgres.service.ts`), que injeta o `Pool` global via `PostgresModule.forRoot(pgConfig())` (registrado uma vez em `app.module.ts`).
- SQL é escrito à mão com placeholders posicionais (`$1, $2, ...`) — **sempre parametrizado**, nunca concatenação de valores de usuário na string (o único ponto de interpolação aceito é a whitelist de `orderBy`/`LIMIT`/`OFFSET`, que já são valores internos/sanitizados).
- Ao adicionar/alterar tabelas, criar migration em `migrations/` com `dbmate` seguindo o padrão `<timestamp de 14 dígitos>_<descrição-kebab>.sql` e blocos `-- migrate:up`/`-- migrate:down` (ver `migrations/20250913151726_add-table-billing-history.sql`). Use `npm run migrate new <descrição-kebab>` para gerar o arquivo com o timestamp correto.

### Assincronismo
- Operações independentes usam `Promise.all` (ex.: buscar produtos + contagem em paralelo — `src/users/users.service.ts:81-94`, `src/sales/new-sale.service.ts:41-45`).
- Escritas multi-tabela **deveriam** usar uma transação real via `PostgresService.getClient()` + `client.query('BEGIN'/'COMMIT')`, como feito em `src/signup/signup.service.ts:32-66`. Isso **não é seguido** em `new-sale.service.ts` e `billing.facade.ts` — ver anti-padrão na seção 6.

## 5. Padrões que DEVEM ser seguidos

- [ ] Toda leitura por `id` deve validar `row.account_id === user.accountId` e lançar `NotFoundException` caso contrário. Referência: `src/users/users.service.ts:106-115`.
- [ ] `accountId` sempre vem de `@User() user: UserSession`, nunca do body/query do request. Referência: `src/sales/sales.controller.ts:29-37`.
- [ ] Ordenação dinâmica (`orderBy`) sempre passa por whitelist `Record<string,string>`. Referência: `src/sales/sales.service.ts:12-19`.
- [ ] DTOs de saída usam `static fromTable(row)` mapeando `snake_case` → `camelCase`. Referência: `src/users/dto/output-user.dto.ts`.
- [ ] Providers substituíveis (hashing, guid, repositórios) são injetados por `Symbol` token, nunca por classe concreta. Referência: `src/libs/libs.module.ts`.
- [ ] Toda query usa parâmetros posicionais (`$1, $2, ...`), nunca template string com valor de usuário embutido. Referência: qualquer `*.service.ts` em `src/`.
- [ ] Migrations novas seguem `dbmate` com `-- migrate:up`/`-- migrate:down` e nome `<timestamp de 14 dígitos>_<kebab>.sql`. Referência: `migrations/`.
- [ ] Controllers ficam finos: parseiam request (`@Param`, `@Query`, `@Body`, `@User`) e delegam 100% da lógica ao service/facade. Referência: `src/users/users.controller.ts`.

## 6. Anti-padrões que NÃO devem ser replicados

### Ausência de transação em escritas multi-tabela

**Encontrado em:** `src/sales/new-sale.service.ts:97-161` (cria transactions, depois billing, depois billing_items em chamadas `query` separadas), `src/billings/facades/billing.facade.ts:100-163`

**Problema:** múltiplas escritas relacionadas (criar transação → criar/atualizar billing → criar billing_item) são feitas como `query()` independentes sem `BEGIN`/`COMMIT`. Uma falha no meio do fluxo deixa o banco em estado inconsistente (ex.: transação criada sem billing_item correspondente).

**Faça em vez disso:** obtenha um client dedicado com `PostgresService.getClient()`, envolva as escritas em `BEGIN`/`COMMIT` (com `ROLLBACK` no catch), como já é feito para a criação de conta+usuário.

**Referência do padrão preferido:** `src/signup/signup.service.ts:32-66`

### Dois mecanismos de logging coexistindo

**Encontrado em:** `src/sales/sales.service.ts:161,171,197` (usa `Logger.log(...)` estático do Nest) vs. `src/sales/new-sale.service.ts:38,81-85` (usa `LOGGER` injetado / Winston)

**Problema:** logs não passam de forma consistente pelo `WinstonLogger` configurado (rotação diária, formato), então parte dos logs de produção pode não ser persistida/roteada como o restante.

**Faça em vez disso:** injete `@Inject(LOGGER) private readonly logger: LoggerService` no service e use `this.logger.log(...)`.

**Referência do padrão preferido:** `src/sales/new-sale.service.ts:29-38`

### SQL inline duplicado em vez de repositório, apesar de a abstração existir

**Encontrado em:** `src/sales/new-sale.service.ts:196-216` reimplementa `getProduct`/`getClientName` com SQL cru, apesar de o módulo já ter `SalesRepository`/`SALES_REPOSITORY` (`src/sales/repository/ports/sales-repository.interface.ts`) com um único método (`billingExists`) implementado.

**Problema:** a camada de repositório existe mas está subutilizada — a maior parte da lógica de acesso a dados continua espalhada em SQL inline dentro dos services/facades, tornando o padrão "repositório" inconsistente entre módulos (`transactions` o usa bem; `sales`, `billings`, `users`, `products`, `clients` não).

**Faça em vez disso:** ao tocar em um módulo que já tem uma interface de repositório (ex.: `sales`), estenda o repositório existente em vez de adicionar mais SQL cru ao service. Para módulos sem repositório (`users`, `products`, `clients`), o padrão atual (SQL direto no service via `PostgresService`) é o dominante — não introduza um repositório isolado só para esse módulo sem alinhar com o time, pois criaria um terceiro padrão.

**Referência do padrão preferido:** `src/transactions/repository/pg-transactions.repository.ts` + `src/transactions/repository/transactions-repository.interface.ts`

### Parâmetro `@User() user` sem tipo

**Encontrado em:** `src/billings/billings.controller.ts:37,45,54,90` (`@User() user` sem anotar `: UserSession`)

**Problema:** perde o autocomplete/checagem de tipos do payload do JWT (`sub`, `accountId`, `email`, `name`); inconsistente com o restante dos controllers.

**Faça em vez disso:** sempre anotar `@User() user: UserSession`.

**Referência do padrão preferido:** `src/users/users.controller.ts:30,41,46,58,71,80` (`UserSession` importado de `src/signin/decorators/user.decorator.ts`)

### Testes unitários vazios ("should be defined")

**Encontrado em:** `src/sales/sales.service.spec.ts`, `src/clients/clients.service.spec.ts` — instanciam o service sem mocks de dependências e só checam `toBeDefined()`.

**Problema:** não cobrem nenhuma regra de negócio real (multi-tenancy, cálculo de billing, ordenação); dão falsa sensação de cobertura.

**Faça em vez disso:** ao alterar um desses services, adicione testes reais mockando `PostgresService`/repositórios e cobrindo os caminhos de erro (`NotFoundException` por `account_id` divergente, cálculos de `amount`).

**Referência de teste com mocks mais completos:** `src/transactions/transactions.service.spec.ts`, `src/dashboard/dashboard.service.spec.ts` (verificar antes de copiar — não inspecionados em profundidade nesta análise).

## 7. Como Implementar uma Nova Funcionalidade

Fluxo típico (HTTP CRUD por feature), seguindo o padrão dominante (ex.: `users`, `products`, `clients`):

1. **Migration:** criar `migrations/<timestamp>_create-<tabela>-table.sql` com `dbmate` (`CREATE TABLE` em SQL puro), incluindo `id uuid` PK, `account_id uuid` FK para `accounts` (`ON DELETE RESTRICT`), `created_at`/`updated_at`.
2. **Módulo:** criar `src/<feature>/<feature>.module.ts` registrando `<Feature>Controller` e `<Feature>Service`; importar `LibsModule` se precisar de `GUID_PROVIDER`/`HASHING_PROVIDER`, e `LoggerModule` se for logar. Registrar o módulo em `src/app.module.ts`.
3. **Entities/DTOs:**
   - `src/<feature>/entities/<feature>.entity.ts` só se a lógica de negócio justificar um objeto rico (senão, um `interface <Feature>Table` no próprio service, como em `products.service.ts`/`clients.service.ts`, é aceitável — é o padrão majoritário).
   - `src/<feature>/dto/create-<feature>.dto.ts`, `update-<feature>.dto.ts`, `query-<feature>.dto.ts` com `class-validator` + `@ApiProperty`.
   - `src/<feature>/dto/output-<feature>.dto.ts` com `static fromTable(row)`.
4. **Service:** `src/<feature>/<feature>.service.ts` injeta `PostgresService` (+ `GUID_PROVIDER`/`HASHING_PROVIDER` se precisar); implementa `create/findAll/findOne/update/remove` seguindo `users.service.ts` como referência — sempre filtrando/validando por `accountId`, sempre com whitelist de `orderBy` se houver ordenação dinâmica.
5. **Controller:** `src/<feature>/<feature>.controller.ts` com `@ApiTags`, `@ApiBearerAuth`, injeta `@User() user: UserSession`, repassa `accountId` ao DTO/service; sem lógica de negócio no handler.
6. **Erros:** lançar `NotFoundException`/`BadRequestException` nativos do Nest no service; não criar filtro de exceção próprio.
7. **Testes:** criar/expandir `<feature>.service.spec.ts` mockando `PostgresService` (não usar banco real) e cobrindo: caminho feliz, `NotFoundException` por `id` inexistente/`account_id` divergente, e regra de negócio específica (cálculo, validação condicional).
8. **Validar antes de concluir:** rodar `npm run lint`, `npm run test`, `npm run build` (ver seção 9).

### Se a operação envolver múltiplas tabelas (ex.: venda gerando fatura)

Siga o padrão de `new-sale.service.ts`/`billing.facade.ts` para a orquestração, **mas** envolva as escritas em transação real (`PostgresService.getClient()` + `BEGIN`/`COMMIT`/`ROLLBACK`), como em `src/signup/signup.service.ts` — não replique a ausência de transação desses dois arquivos (ver seção 6).

## 8. Estratégia de Testes

- **Unitário:** Jest + `@swc/jest`, arquivos `*.spec.ts` colocados ao lado do código-fonte em `src/`. `rootDir: src`, `testRegex: .*\.spec\.ts$` (config em `package.json`). Rodar com `npm run test`.
- **E2E:** Jest + `ts-jest`, config em `test/jest-e2e.json`, arquivos `*.e2e-spec.ts` em `test/`. Hoje só existe o boilerplate `app.e2e-spec.ts` — **não determinado com confiança** que haja cobertura e2e real das features de negócio. Rodar com `npm run test:e2e`.
- **Cobertura:** `npm run test:cov` gera relatório em `coverage/`.
- Não há setup de banco de dados de teste dedicado nem fixtures/factories identificados no repositório — os poucos specs existentes não tocam o banco real (instanciam o service sem mocks e só checam `toBeDefined()`, ver anti-padrão na seção 6). Ao escrever testes reais, mockar `PostgresService` diretamente (não há helper de mock pronto no repositório — criar um simples `{ query: jest.fn() }` é consistente com o estilo do projeto).

## 9. Comandos Úteis

```bash
# instalar dependências
npm install

# desenvolvimento (watch mode)
npm run start:dev

# build
npm run build

# produção (após build)
npm run start:prod

# lint (com --fix)
npm run lint

# formatação
npm run format

# testes unitários
npm run test
npm run test:watch
npm run test:cov

# testes e2e
npm run test:e2e

# migrations (dbmate)
npm run migrate up
npm run migrate down
npm run migrate new <descrição-kebab>
npm run migrate status
```

Banco local via Docker: `docker compose up -d db` (ver `README.md` e `docker-compose.yml`).

## 10. Checklist antes de concluir uma alteração

- [ ] A implementação respeita as fronteiras arquiteturais existentes (controller fino, lógica no service/facade, acesso a dados via `PostgresService` ou repositório do módulo).
- [ ] Toda leitura/escrita por `id` valida `account_id` do usuário autenticado.
- [ ] Não foi replicado nenhum anti-padrão legado da seção 6 (SQL sem transação em escrita multi-tabela, `Logger.log` estático em vez do `LOGGER` injetado, `@User() user` sem tipo `UserSession`).
- [ ] Validações de entrada estão no DTO (`class-validator`), não reimplementadas no service.
- [ ] Ordenação/filtros dinâmicos passam por whitelist antes de entrar em SQL.
- [ ] Erros usam exceções nativas do Nest (`NotFoundException`, `BadRequestException`, etc.).
- [ ] Testes relevantes foram adicionados/atualizados (idealmente com mocks reais, não apenas `toBeDefined()`).
- [ ] `npm run lint`, `npm run test` e `npm run build` passam.
- [ ] Migration criada/atualizada em `migrations/` se houve mudança de schema.
- [ ] Nenhuma mudança não relacionada foi introduzida.

## 11. Áreas de Atenção

- **Transações ausentes em `new-sale.service.ts` e `billing.facade.ts`:** risco real de inconsistência de dados em falhas parciais (seção 6). Qualquer mudança nesses fluxos é uma boa oportunidade para introduzir transação real.
- **Logging duplicado (Winston injetado vs. `Logger` estático do Nest):** inconsistente entre módulos; padronizar gradualmente para o `LOGGER` injetado ao tocar em código existente.
- **Camada de repositório parcial:** existe em `transactions` (completo) e `sales` (só um método, `billingExists`, pouco usado); os demais módulos (`users`, `products`, `clients`, `billings`) acessam Postgres diretamente do service/facade. Não é um padrão "errado" isolado — é o padrão dominante hoje — mas está em transição; verificar se há decisão do time antes de introduzir repositório em um módulo que não tem.
- **`ValidationException` (`src/exceptions/validation.exception.ts`) parece não utilizada** — confirmar antes de removê-la ou de usá-la como padrão.
- **Cobertura de testes real é baixa:** vários `*.spec.ts` são apenas boilerplate (`toBeDefined()`); `test/app.e2e-spec.ts` também é o boilerplate padrão do Nest, sem cobertura das rotas de negócio.
- **`signin.service.ts` define sua própria `interface UserTable` local** (diferente de `UsersTable` em `src/users/ports/users-table.interface.ts`) com tipos que não batem com o schema real (`id: number`/`account_id: number`, enquanto a migration `migrations/1723330426605_create-users-table.js` define `id`/`account_id` como `uuid`) — tratar como anotação de tipo imprecisa (herdada, sem efeito em runtime), não copiar esse formato para novos arquivos.

## 12. Regras Detalhadas (carregar sob demanda)

Este `AGENTS.md` cobre o essencial para qualquer alteração. Para os assuntos abaixo, existem guias mais profundos em `rules/` — **carregue apenas o arquivo relevante para a tarefa em mãos**, não todos de uma vez. Todos já foram revisados e corrigidos para refletir o stack real deste repositório (`pg` puro, `dbmate`, `account_id`, sem Clean Architecture) — cada um tem uma nota "Nota de aderência ao repositório" no topo apontando o que é real vs. aspiracional.

| Quando carregar | Arquivo | Cobre |
| --- | --- | --- |
| Criando/alterando endpoints HTTP, DTOs de request/response, paginação, códigos de status, ou revisando um contrato de API | `rules/api-style-guide.md` | Modelagem de recursos REST, `PATCH` vs `PUT` vs endpoints de comando, `404` para recurso fora do tenant, contrato de paginação (`{data, meta}`), checklist de revisão de API |
| Criando/alterando migration, tabela, índice, ou qualquer service/facade que escreve SQL | `rules/postgres-guideline.md` | Convenções de schema (tipos de coluna, PK/FK, `account_id`), quando usar transação real, quando (não) usar soft delete, exemplo de query via `PostgresService` |
| Escrevendo ou revisando uma query específica (performance, sargability, `ORDER BY`, busca `ILIKE`, paginação, índices) | `rules/postgres-queries.md` | Regras de sargability, prefixo vs. contains search, `EXISTS`/`JOIN`, whitelist de `orderBy`, índices por padrão de query |
| Criando ou revisando testes (`*.spec.ts`, e2e) | `rules/testing-standards.md` | Estrutura AAA, isolamento/determinismo, mocks com Jest, convenção de localização de testes, o que testar em unit vs. e2e |
| Desenhando/revisando uma classe, service ou interface e avaliando responsabilidade, acoplamento ou se vale a pena introduzir uma abstração (repositório, strategy, etc.) | `rules/solid-principles.md` | Aplicação pragmática de SRP/OCP/LSP/ISP/DIP com exemplos do repo, e quando **não** vale a pena abstrair |

Não é necessário carregar esses arquivos para alterações triviais (ex.: corrigir um typo, ajustar uma mensagem de erro) — use-os quando a tarefa envolver decisões de design em uma dessas áreas.
