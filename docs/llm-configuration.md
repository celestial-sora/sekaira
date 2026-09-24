# LLM configuration

Oonchai has one provider adapter and one model-selection point: `src/lib/llm.ts`.

To change the source default for every environment, replace `DEFAULT_ROLEPLAY_MODEL` with a supported entry from `GROQ_MODELS`, or add an enabled Groq model ID to that list. The roleplay engine, memory extractor, and World Director all use the selected model automatically.

To choose a model without a code change, set the server-only `GROQ_MODEL` environment variable. It overrides the source default. For Vercel, change `GROQ_MODEL` in the project environment variables, then redeploy so new requests use the chosen model.

If the configured model has been retired, is unavailable to the Groq project, or returns an invalid structured response, Oonchai retries the current roleplay and fast models in `GROQ_MODELS`. Keep those fallback IDs on models enabled for the Groq project.

The current model appears in Oonchai Settings. This is informational only; users cannot choose the model and no API key reaches the browser.

For named existing characters, the generator keeps the requested name and work as fixed identity anchors and checks the draft before filling the form. Set the optional server-only `TAVILY_API_KEY` to let it search for canon reference details. Without that key, it relies on the model's knowledge and instructs it to leave uncertain optional biography details blank. Requests that fail the identity check return an error instead of an unrelated character draft.
