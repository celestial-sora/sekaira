# LLM configuration

Sekaira has one provider adapter and one model-selection point: `src/lib/llm.ts`.

To change the source default for every environment, replace `DEFAULT_ROLEPLAY_MODEL` with a supported entry from `GROQ_MODELS`, or add an enabled Groq model ID to that list. The roleplay engine, memory extractor, and World Director all use the selected model automatically.

To choose a model without a code change, set the server-only `GROQ_MODEL` environment variable. It overrides the source default. For Vercel, change `GROQ_MODEL` in the project environment variables, then redeploy so new requests use the chosen model.

The current model appears in Sekaira Settings. This is informational only; users cannot choose the model and no API key reaches the browser.
