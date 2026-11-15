import { validateSchema } from './sdk-contract.ts';

export const validateBody = (name: string, body: unknown): Promise<void> =>
  validateSchema(name, body, name);
