export const productionAccount: Readonly<{ url: string; publishableKeySha256: string }>;
export function productionConfig(
  env: Record<string, string | undefined>,
  target?: typeof productionAccount,
): { accountCloud: boolean; projectUrl: string; publishableKeySha256: string };
export function verifyProductionBuild(directory?: string): {
  version: string;
  accountCloud: boolean;
  projectUrl: string;
  publishableKeySha256: string;
};
