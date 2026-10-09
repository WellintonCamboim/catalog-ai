import { isValidObjectId, Types, type Query, type Schema } from 'mongoose';

export class TenantScopeError extends Error {
  constructor(operation: string) {
    super(`Tenant scope violation: "${operation}" must filter by a concrete company_id`);
    this.name = 'TenantScopeError';
  }
}

const QUERY_OPS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'countDocuments',
] as const;

const UPDATE_OPS: readonly string[] = ['findOneAndUpdate', 'updateOne', 'updateMany'];

// Rejects missing values and operator objects such as { $ne: id }, which would match other tenants.
function isConcreteTenant(value: unknown): boolean {
  return value instanceof Types.ObjectId || (typeof value === 'string' && isValidObjectId(value));
}

function touchesTenantField(update: unknown): boolean {
  if (!update || typeof update !== 'object') return false;
  return Object.entries(update as Record<string, unknown>).some(
    ([key, value]) =>
      key === 'company_id' ||
      (key.startsWith('$') && value && typeof value === 'object' && 'company_id' in value),
  );
}

/**
 * Makes tenant isolation a property of the model instead of a convention:
 * any query or aggregation that does not filter by a concrete company_id throws,
 * and company_id can never be changed by an update.
 */
export function tenantScope(schema: Schema): void {
  for (const operation of QUERY_OPS) {
    schema.pre(operation, function (this: Query<unknown, unknown>) {
      if (!isConcreteTenant(this.getFilter().company_id)) throw new TenantScopeError(operation);
      if (UPDATE_OPS.includes(operation) && touchesTenantField(this.getUpdate())) {
        throw new Error('company_id is immutable');
      }
    });
  }

  schema.pre('aggregate', function () {
    const first = this.pipeline()[0] as { $match?: { company_id?: unknown } } | undefined;
    if (!isConcreteTenant(first?.$match?.company_id)) throw new TenantScopeError('aggregate');
  });
}
