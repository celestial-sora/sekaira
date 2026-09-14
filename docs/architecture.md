# Oonchai: two equal entry paths

Source: https://app.notion.com/p/3da7ab0c0f3e81818f72f19c809fb805
The user's clarification on 2026-09-13 takes precedence over any ambiguous document wording. The initial workspace contained no application source. Groq is the selected model provider.

## Product contract

Discover exposes equally prominent Create Character and Create World actions, plus separate character and world discovery sections.

1. /characters/new → /characters/:id → Chat Now → /chat/:id. World, scenario and persona may all be NULL. No implicit world, scenario or persona is created.
2. /worlds/new → /worlds/:id → create/select a persona → add existing or create characters → start /chat/:id. Scenarios remain optional. World creation does not own standalone character creation.
3. /create exposes Character, World and Persona separately.

## Independent entities

Users own private characters, worlds, personas, conversations, memories and relationships. Original seeded content is readable by everyone. Characters have nullable world_id/scenario_id for their origin. world_characters is a membership table: importing an OC does not modify its origin or standalone chat behavior. Worlds support many characters. Scenarios and avatars have their own tables.

Conversations reference nullable world_id, scenario_id and persona_id. Scene participants are separate from world membership. A standalone conversation has one character and no world; world conversations select at most five active characters, with one active scene per conversation. Memories and world changes are scoped to the user and conversation world/persona; standalone memory is scoped to its character and user. Imported characters cannot retrieve their standalone memories in a world context.

## Engine boundaries

Groq adapter → Director (world mode only) → relevant character replies → bounded memory extraction. Character prompts contain only public persona facts and memories visible to that character. Persona secrets are never passed to character models. Director output is validated; world state and relationships update only after the complete turn succeeds, inside a database transaction. A failed model call does not save partial messages or memory. A per-conversation database lease prevents concurrent turns. Never invent a user action or feeling.

Memory retrieval applies owner, world/persona or standalone character scope, known_by permission, lexical relevance, importance, confidence and recency. MVP uses ranked lexical retrieval; semantic embeddings are a later improvement. Extracted memory knowledge is limited to actual scene participants. Manual private notes remain user-only.

## Runtime and integrations

Next.js App Router, SQLite with foreign keys/WAL, Zod validation, Groq server-side chat completion calls. Google OAuth authorization code with state and PKCE; opaque, hashed, expiring database sessions. Development guest sessions are separate per browser and disabled in production. VRM presentation uses Three.js and @pixiv/three-vrm independently of chat. No voice features.

## Verification gates

- Create OC with world/scenario/persona omitted; start standalone chat and preserve all three NULLs.
- Create world; create persona; import OC without mutating origin; start multi-character roleplay with no scenario.
- Persist conversations; isolate owners; prevent cross-world/private memory leakage.
- Missing Groq config or upstream error returns a clear error and does not fabricate a reply.
- Build/typecheck plus browser checks of both creation journeys and responsive layout.

## Deployment prerequisites

Real Groq responses require GROQ_API_KEY. Google login requires this project's OAuth credentials and callback registration. VRM animation requires a compatible licensed .vrm asset. Production needs a persistent Node host/volume for SQLite, HTTPS APP_URL and Google login. This implementation is not a public multi-instance hosted service.
