/**
 * Oonchai's single model-selection point.
 *
 * To change the default in source, update DEFAULT_ROLEPLAY_MODEL below.
 * To select a model per environment without a code change, set GROQ_MODEL.
 * Model IDs must be ones currently enabled for the Groq project.
 */
export const GROQ_MODELS = {
  roleplay: 'openai/gpt-oss-120b',
  fast: 'openai/gpt-oss-20b',
  reasoning: 'openai/gpt-oss-120b',
} as const;

export const DEFAULT_ROLEPLAY_MODEL = GROQ_MODELS.roleplay;

export type LlmConfig = {
  provider: 'groq';
  model: string;
  endpoint: string;
};

export function groqModelCandidates(config: LlmConfig = llmConfig()): string[] {
  return [...new Set([config.model, GROQ_MODELS.roleplay, GROQ_MODELS.fast])];
}

export function llmConfig(): LlmConfig {
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_ROLEPLAY_MODEL;
  return {
    provider: 'groq',
    model,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  };
}
