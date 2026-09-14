/**
 * Sekaira's single model-selection point.
 *
 * To change the default in source, update DEFAULT_ROLEPLAY_MODEL below.
 * To select a model per environment without a code change, set GROQ_MODEL.
 * Model IDs must be ones currently enabled for the Groq project.
 */
export const GROQ_MODELS = {
  roleplay: 'llama-3.3-70b-versatile',
  fast: 'llama-3.1-8b-instant',
  reasoning: 'openai/gpt-oss-120b',
} as const;

export const DEFAULT_ROLEPLAY_MODEL = GROQ_MODELS.roleplay;

export type LlmConfig = {
  provider: 'groq';
  model: string;
  endpoint: string;
};

export function llmConfig(): LlmConfig {
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_ROLEPLAY_MODEL;
  return {
    provider: 'groq',
    model,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  };
}
