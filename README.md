# Central Inteligente de Processamento de Pedidos

Monólito fullstack para recebimento, processamento e gerenciamento de pedidos via chat com IA.

### 1. Tela Chat

<img width="2559" height="1311" alt="Captura de tela 2026-04-01 160717" src="https://github.com/user-attachments/assets/6a60acf5-3c46-4405-9ee0-2153e1b69784" />

### 2. Tela Admin 

<img width="2558" height="1306" alt="Captura de tela 2026-04-01 160728" src="https://github.com/user-attachments/assets/03f56d84-c317-4c9d-b40a-1ea6735f01ae" />

---


# Como usei IA no desenvolvimento

Utilizei IA (ChatGPT) como ferramenta de aceleração e apoio em decisões técnicas, mas com revisão manual em todas as etapas.

## 1. Definição do problema e escopo

Usei IA para interpretar o desafio e identificar entidades principais (pedido, itens, conversa).
Avaliei com a IA diferentes abordagens (CRUD simples vs fluxo conversacional).
Decisão final foi manual: optei por fluxo conversacional para simular cenário real.

## 2. Arquitetura

IA sugeriu separação entre parsing, estado da conversa e persistência.
Refinamento manual: adaptei para um monólito em Next.js 14 para reduzir complexidade e tempo de entrega.
Decisão consciente de usar SQLite + Prisma pela simplicidade.

## 3. Parsing com IA

IA ajudou a estruturar o prompt para extração de dados em JSON.
Defini explicitamente o formato esperado (produto, quantidade, data, cliente).
Ajustei o prompt manualmente para evitar respostas ambíguas e melhorar consistência.

## 4. Validação de dados

IA sugeriu estrutura inicial de validação.
Corrigi manualmente usando Zod para garantir tipagem forte e evitar dados inválidos vindos da IA.

## 5. Geração de código

IA foi usada para acelerar:
criação de endpoints
estrutura inicial de componentes React
Todo código foi revisado e ajustado manualmente antes de ser utilizado.

## 6. UI/UX

IA sugeriu estrutura básica de interface (chat + painel admin).
Refinamento manual focado em clareza de fluxo e usabilidade.

## 7. Debug e correções

Usei IA para identificar possíveis causas de erros.
Validação final sempre manual (logs, testes e inspeção de dados).
Onde a IA errou e como corrigi
IA gerou parsing inconsistente para múltiplos itens
- Corrigi reforçando o prompt e adicionando validação com Zod
IA sugeriu estrutura muito genérica para pedidos
- Ajustei para refletir melhor o domínio (itens, status, confirmação)
IA não tratava corretamente estados da conversa
- Implementei controle manual de fluxo (início → coleta → confirmação)
Como validei o uso da IA
Testei manualmente múltiplos inputs de texto livre
Verifiquei consistência do JSON gerado
Adicionei validações para evitar respostas inválidas
Revisei todo código gerado antes de integrar

---

## Instruções de Execução

### Pré-requisitos

- Node.js 18+
- Conta na [OpenAI](https://platform.openai.com/) com chave de API ativa

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="file:./prisma/dev.db"
OPENAI_API_KEY="sk-..."
```

### 3. Criar o banco de dados

```bash
npm run db:push
```

Aplica o schema Prisma no SQLite local e gera o Prisma Client.

### 4. Iniciar o servidor

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

> **Primeira execução:** após subir o servidor, acesse `http://localhost:3000/api/setup` uma vez para garantir que todas as tabelas e colunas estejam criadas corretamente.

---

## Rotas da Aplicação

| Rota      | Descrição                                                      |
| --------- | -------------------------------------------------------------- |
| `/`       | Simulador de clientes — chat multi-turno com IA                |
| `/admin`  | Central de pedidos — tabela de pedidos e catálogo de produtos  |

## Endpoints da API

| Método   | Rota                              | Descrição                                                     |
| -------- | --------------------------------- | ------------------------------------------------------------- |
| `GET`    | `/api/conversations`              | Lista todas as conversas                                      |
| `POST`   | `/api/conversations`              | Cria conversa e processa a primeira mensagem                  |
| `POST`   | `/api/conversations/:id/messages` | Envia mensagem em conversa existente                          |
| `GET`    | `/api/admin/orders`               | Lista pedidos com filtro por status e busca por cliente       |
| `PATCH`  | `/api/admin/orders/:id`           | Avança status do pedido                                       |
| `GET`    | `/api/admin/products`             | Lista produtos do catálogo                                    |
| `POST`   | `/api/admin/products`             | Cadastra novo produto                                         |
| `DELETE` | `/api/admin/products/:id`         | Remove produto do catálogo                                    |
| `GET`    | `/api/setup`                      | Inicializa tabelas extras (executar uma vez na 1ª execução)   |

---

## Explicação do Uso de IA

### Modelo utilizado

**GPT-4o-mini** via API da OpenAI com `response_format: { type: "json_object" }` e `temperature: 0.2`.

### Função da IA no sistema

A IA atua como atendente virtual de pedidos em linguagem natural. A cada turno de conversa recebe o histórico completo e retorna um JSON estruturado:

```json
{
  "reply": "mensagem para o cliente",
  "order": {
    "cliente": "nome do cliente",
    "itens": [{ "produto": "farinha", "quantidade": 10 }],
    "data_entrega": "2026-04-02"
  },
  "status": "collecting | awaiting_confirmation | confirmed | cancelled",
  "updatedCustomerName": "nome corrigido ou null"
}
```

### Fluxo de estados gerenciado pela IA

```text
collecting → awaiting_confirmation → confirmed
                                   ↘ cancelled
```

1. **collecting** — IA solicita informações faltantes (data de entrega)
2. **awaiting_confirmation** — IA apresenta resumo completo e aguarda confirmação do cliente
3. **confirmed** — cliente confirmou; pedido é registrado no banco
4. **cancelled** — cliente cancelou

### Responsabilidades da IA

| Tarefa | Como é feita |
|--------|-------------|
| Extração de itens e quantidades | IA interpreta linguagem natural ("quero 10 kg de farinha") |
| Resolução de datas relativas | "hoje", "amanhã", "na sexta" são convertidos para `YYYY-MM-DD` com a data atual injetada no prompt |
| Uso do nome do cliente | O nome é fornecido pelo sistema via prompt; a IA nunca o solicita novamente |
| Correspondência de produtos | A lista do catálogo é enviada no prompt; a IA faz o match silenciosamente ("cafe" → "café") |
| Continuidade da conversa | O histórico completo é enviado a cada turno, permitindo contexto sem estado no servidor |

### Validação das respostas

O JSON retornado pela IA é validado com **Zod** antes de qualquer operação no banco:

```typescript
const AIResponseSchema = z.object({
  reply: z.string().min(1),
  order: z.object({
    cliente: z.string().min(1),
    itens: z.array(z.object({
      produto: z.string().min(1),
      quantidade: z.number().int().positive(),
    })).min(1),
    data_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }).nullable(),
  status: z.enum(["collecting", "awaiting_confirmation", "confirmed", "cancelled"]),
  updatedCustomerName: z.string().nullable().optional(),
});
```

Se a validação falhar, a API retorna erro 500 sem salvar dados inconsistentes.

---

## Decisões Técnicas

### Stack

| Tecnologia | Motivo |
|------------|--------|
| **Next.js 14 App Router** | Unifica frontend e API Routes em um único projeto sem servidor separado |
| **TypeScript** | Tipagem estática reduz erros em runtime nas integrações com IA e banco |
| **Prisma + SQLite** | Setup zero-config para desenvolvimento local; ORM com type-safety |
| **Tailwind CSS** | Estilização rápida e consistente sem arquivos CSS separados |
| **Zod** | Validação de schema em runtime para saída da IA (fonte não confiável) |
| **OpenAI SDK** | Cliente oficial com tipagem completa e tratamento de `APIError` |

### Chat stateless com histórico completo

O histórico completo da conversa é enviado para a IA a cada turno. O modelo não mantém estado — cada chamada é independente. O estado real fica na tabela `Message` do banco. Isso garante consistência mesmo em reinicializações do servidor e simplifica o design.

### Singleton do Prisma Client

```typescript
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

O hot-reload do Next.js reinstancia módulos a cada mudança. Sem o singleton, seriam criadas centenas de conexões durante o desenvolvimento. Anexar ao `globalThis` resolve sem afetar produção.

### Correspondência fuzzy de produtos

Implementada em `src/lib/inventory.ts` via normalização NFD — remove acentos e caracteres especiais para comparação. Resolve variações como "cafe", "Café" e "CAFÉ" sem depender de chamadas extras à IA:

```typescript
function normalizeText(text: string): string {
  return text.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}
```

Os itens fora do catálogo são recalculados dinamicamente a cada carregamento da tabela de pedidos, então um produto recém-cadastrado remove o alerta automaticamente sem precisar atualizar os registros existentes.

### Compatibilidade com Prisma Client desatualizado (Windows)

Em Windows, o arquivo `query_engine-windows.dll.node` pode ficar bloqueado pelo processo do servidor, impedindo `prisma generate` enquanto o dev server está ativo. Para garantir que o sistema funcione sem precisar parar o servidor:

- **`src/lib/prisma-safe.ts`** — operações no modelo `Product` usam `$queryRawUnsafe` / `$executeRawUnsafe` com `CREATE TABLE IF NOT EXISTS` automático na primeira chamada
- **`src/lib/migrate.ts`** — colunas novas em `Order` (`adminStatus`, `unknownItems`, `updatedAt`) são adicionadas via `ALTER TABLE` na primeira requisição se ainda não existirem
- **`/api/setup`** — rota auxiliar que cria todas as estruturas faltantes via SQL direto

### Status de pedidos unidirecional

Transições de status no admin seguem uma máquina de estados estrita:

```text
pending → confirmed → finalized
```

Transições inválidas retornam HTTP `422 Unprocessable Entity`. Isso evita regressões acidentais de status e mantém o histórico íntegro.

### Items como JSON serializado

SQLite não tem tipo nativo para arrays. Os campos `items` e `unknownItems` são serializados com `JSON.stringify` na escrita e desserializados com `JSON.parse` na leitura. Com PostgreSQL, seria possível usar o tipo `Json` nativo do Prisma.

### Registro imediato de pedidos no admin

O registro de `Order` é criado desde a primeira mensagem do cliente, com `deliveryDate` vazio. Isso garante que todo cliente apareça na central de pedidos imediatamente, mesmo durante a coleta de informações. O registro é atualizado a cada mensagem conforme os dados são definidos.
