import type { Tool, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';
import { productRepository } from '../products/product.repository.js';

// Built from the server-side session. The model never chooses (or even sees) the tenant.
export interface ToolContext {
  companyId: string;
}

interface AgentTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run(ctx: ToolContext, input: z.infer<S>): Promise<unknown>;
}

const searchProductsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Texto a buscar no nome ou na descrição'),
  category: z.string().trim().min(1).max(60).optional().describe('Nome exato da categoria'),
  min_price: z.number().min(0).optional().describe('Preço mínimo em reais'),
  max_price: z.number().min(0).optional().describe('Preço máximo em reais'),
  limit: z.number().int().min(1).max(20).default(10).describe('Máximo de produtos a retornar'),
});

const searchProducts: AgentTool<typeof searchProductsSchema> = {
  name: 'search_products',
  description:
    'Busca produtos no catálogo da empresa do cliente. Todos os filtros são opcionais; sem filtros, retorna os produtos mais recentes.',
  schema: searchProductsSchema,
  async run({ companyId }, input) {
    const { items, total } = await productRepository.list(companyId, {
      q: input.query,
      category: input.category,
      minPrice: input.min_price,
      maxPrice: input.max_price,
      limit: input.limit,
    });
    return {
      total_matches: total,
      products: items.map((p) => ({
        name: p.name,
        description: p.description,
        price_brl: p.price,
        category: p.category,
        image_url: p.imageUrl ?? null,
      })),
    };
  },
};

const listCategoriesSchema = z.object({});

const listCategories: AgentTool<typeof listCategoriesSchema> = {
  name: 'list_categories',
  description: 'Lista as categorias de produtos disponíveis no catálogo da empresa.',
  schema: listCategoriesSchema,
  async run({ companyId }) {
    return { categories: await productRepository.listCategories(companyId) };
  },
};

const tools: AgentTool[] = [searchProducts, listCategories] as AgentTool[];

export const toolDefinitions: Tool[] = tools.map((t) => {
  const inputSchema = z.toJSONSchema(t.schema) as Record<string, unknown>;
  delete inputSchema.$schema;
  return {
    name: t.name,
    description: t.description,
    input_schema: inputSchema as Tool['input_schema'],
  };
});

export async function executeTool(
  ctx: ToolContext,
  toolUseId: string,
  name: string,
  rawInput: unknown,
): Promise<ToolResultBlockParam> {
  const fail = (message: string): ToolResultBlockParam => ({
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: message,
    is_error: true,
  });

  const tool = tools.find((t) => t.name === name);
  if (!tool) return fail(`Ferramenta desconhecida: ${name}`);

  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) return fail(`Parâmetros inválidos: ${z.prettifyError(parsed.error)}`);

  try {
    const result = await tool.run(ctx, parsed.data);
    return { type: 'tool_result', tool_use_id: toolUseId, content: JSON.stringify(result) };
  } catch {
    return fail('Erro interno ao consultar o catálogo');
  }
}
