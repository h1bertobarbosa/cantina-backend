---
name: solid-principles
description: Guia de aplicação pragmática dos princípios SOLID neste repositório — quando valem a pena e quando são over-engineering para o padrão dominante do projeto.
---

# SOLID — Guia de Aplicação Pragmática

> **Nota de aderência ao repositório:** este projeto **não** segue Clean Architecture nem tem uma camada de repositório consistente (ver `AGENTS.md` seção 6 e 11). A maioria dos módulos (`users`, `products`, `clients`, `billings`) acessa o Postgres diretamente do service via `PostgresService`, sem interfaces de repositório. Só `transactions` tem uma camada de repositório completa (`TransactionsRepository`/`PgTransactionsRepository`), e `sales` tem uma versão parcial (`SalesRepository`, só `billingExists`). Os exemplos abaixo usam essa realidade como referência — **não** proponha introduzir Ports & Adapters em todos os módulos só por causa deste guia; isso criaria um terceiro padrão conflitante (ver `AGENTS.md` seção 6, "SQL inline duplicado").

SOLID é um conjunto de 5 princípios de design orientado a objetos que ajudam a manter o software mais fácil de entender, modificar, testar e evoluir. O objetivo **não é maximizar interfaces, classes ou abstrações** — é controlar acoplamento e o custo de mudanças futuras prováveis. Um CRUD simples não precisa de 8 camadas para ser "SOLID".

## Quando usar

- Ao revisar ou desenhar um novo service/facade que está acumulando responsabilidades não relacionadas.
- Ao decidir se um ponto de variação (ex.: novo tipo de desconto, novo método de pagamento) deveria virar uma abstração (`Strategy`, interface) ou continuar um `if`/`switch` simples.
- Ao criar uma nova subclasse/implementação de uma interface existente (`*Repository`, `*Provider`) e avaliar se ela realmente respeita o contrato.
- Ao decidir o tamanho de uma interface de repositório/porta antes de estendê-la.
- Ao avaliar se uma regra de negócio está acoplada demais a um detalhe técnico (driver `pg`, biblioteca externa).

## Os 5 princípios, aplicados a este repo

### S — Single Responsibility Principle

Uma classe/service não deveria acumular responsabilidades que mudam por motivos diferentes (regra de negócio, persistência, formatação de saída, logging, etc.).

- **Sinal de alerta:** um service como `new-sale.service.ts` ou `billing.facade.ts` crescendo para também montar SQL de outras entidades (`getProduct`, `getClientName` reimplementados em vez de reusar `SalesRepository`), formatar resposta HTTP, ou gerar PDF/e-mail.
- **Faça:** extraia responsabilidades divergentes para colaboradores injetados (repositório, calculador, provider), como já ocorre com `GUID_PROVIDER`/`HASHING_PROVIDER` (`src/libs/`).
- **Cuidado:** SRP não significa "um método por classe". Um `UsersService` com `create/findAll/findOne/update/remove` é uma única responsabilidade (gerenciar o ciclo de vida de `User`), não cinco.

### O — Open/Closed Principle

Extensível sem modificar código estável. Só vale a pena quando existe um ponto de variação **real e recorrente** — não crie `Strategy`/factory antecipadamente para dois `if`s que dificilmente vão mudar.

- **Onde já existe no repo:** providers por token (`GUID_PROVIDER`, `HASHING_PROVIDER`) permitem trocar a implementação (`UuidV7Provider`, `BcryptHashingProvider`) sem tocar em quem consome.
- **Onde considerar:** se `TransactionPaymentMethod` ou `BillingItemTypeEnum` (`.vo.ts`) começarem a acumular `if`/`switch` espalhados pelo código para calcular comportamento diferente por tipo, isso é sinal de que vale extrair uma abstração por tipo.
- **Não faça:** transformar todo `if (status === 'paid')` em uma hierarquia de classes. Se a variação é estável (poucos casos, mudança rara), o `if` é a solução mais simples e correta.

### L — Liskov Substitution Principle

Toda implementação de uma interface do repo (`*Repository`, `*Provider`) deve poder ser usada onde a interface é esperada, sem quebrar a expectativa do consumidor.

- **Aplicação direta:** `PgTransactionsRepository` implementa `TransactionsRepository` — qualquer novo adapter (ex.: um repositório em memória para teste) precisa cumprir os mesmos contratos, incluindo lançar as mesmas exceções (`NotFoundException`) nos mesmos casos, não silenciar ou lançar algo inesperado.
- **Sinal de alerta:** um método de uma implementação concreta que lança `Error('not implemented')` ou muda o comportamento de forma que o chamador precise saber qual implementação concreta está por trás da interface (`instanceof` checks). Isso indica que a interface está mal desenhada — considere dividir (ver ISP abaixo) em vez de forçar uma implementação parcial.

### I — Interface Segregation Principle

Interfaces pequenas e específicas para cada consumidor, em vez de uma interface "gorda" com métodos que a maioria dos consumidores não usa.

- **Aplicação direta:** ao estender `SalesRepository` (que hoje só tem `billingExists`) ou `TransactionsRepository`, adicione métodos pensando em quem consome — não crie um repositório genérico com `findAll/save/delete/exportToCsv/generateReport` todo de uma vez só porque "pode ser útil depois".
- **Cuidado:** não fragmente ao extremo (uma interface por método). A divisão deve refletir consumidores reais distintos (ex.: leitura vs. escrita), não dogma.

### D — Dependency Inversion Principle

Regras de negócio importantes não devem depender diretamente de detalhes técnicos externos.

- **Já aplicado no repo:** todo acesso a banco passa por `PostgresService.query<T>(sql, params)` em vez de os services instanciarem o driver `pg` diretamente — isso já é uma forma de DIP (a regra de negócio depende de uma abstração interna, não do driver bruto).
- **Aplicação mais forte, onde existe:** `transactions` depende de `TransactionsRepository` (interface via token DI), não de `PgTransactionsRepository` diretamente — é o padrão mais próximo do ideal no repo hoje.
- **Não generalize sem alinhamento:** para `users`/`products`/`clients`/`billings`, o padrão dominante é SQL direto no service via `PostgresService` (ver `AGENTS.md` seção 6 e 11). Introduzir uma interface de repositório isolada nesses módulos sem decisão de time cria um terceiro padrão conflitante — não faça isso apenas para "seguir DIP".

## Como decidir na prática

Ao tocar em um service/facade, pergunte:

```
S → Essa classe está fazendo coisas que mudam por motivos diferentes?
O → Existe um ponto de variação frequente que deveria ser extensível?
L → Minha implementação realmente respeita o contrato que promete (mesmos erros, mesmo comportamento esperado)?
I → Estou obrigando consumidores a depender de métodos que não usam?
D → Minha regra de negócio está acoplada a um detalhe técnico que poderia estar atrás de uma interface?
```

A pergunta mais útil é **"qual mudança provável quero tornar barata?"**. Se nenhuma mudança relevante justifica a abstração, mantenha o design simples — é consistente com o estado atual do repositório (SQL direto no service é o padrão dominante, não um anti-padrão a ser eliminado às pressas).

## Não faça

- Não introduza uma camada de repositório em um módulo que não tem (`users`, `products`, `clients`, `billings`) só para "ficar SOLID" — isso conflita com o padrão dominante e com o anti-padrão já documentado em `AGENTS.md` seção 6.
- Não crie `Strategy`/factory para variações que não mudam com frequência.
- Não fragmente interfaces de repositório em um método por interface.
- Não use SOLID como justificativa para adicionar camadas (`UseCase`, `Port`, `Gateway`, `DomainService`) que não existem hoje no repositório sem alinhar com o time antes.
