import { step } from './fixture';

export async function typedStep(): Promise<number> {
  const value = await step('x', async () => 1);
  return value;
}
