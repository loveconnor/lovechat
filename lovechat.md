# LoveChat: Detailed Application and Feature Guide

## 1. What LoveChat Is

LoveChat is a full-stack AI chat product organized as a pnpm monorepo with three apps:

- `apps/web`: Primary user-facing web app (TanStack Start + React + Vite)
- `apps/backend`: API and AI orchestration server (Fastify + PostgreSQL + Redis + OpenAI)
- `apps/desktop`: Electron desktop shell that can auto-start web/backend dependencies

At a product level, LoveChat combines:

- Authentication and session-based account access
- Onboarding and user profile personalization
- Multi-session conversational chat
- Configurable model selection (OpenAI + optional Ollama local models)
- Optional web search augmentation for answers
- Learning mode (Socratic tutoring personality)
- Rich content rendering (Markdown, math, citations, charts, generated images)
- File attachments (including text extraction from PDFs and inline image support)
- Data controls, data export, and account deletion
- Chat export to Markdown and print-to-PDF

## 2. Monorepo and Runtime Topology

### 2.1 Workspace Layout

Top-level configuration includes:

- `package.json` with monorepo scripts (`dev`, `build`, `lint`, `check`, etc.)
- `pnpm-workspace.yaml` for workspace boundaries
- `docker-compose.yml` for local PostgreSQL and Redis

### 2.2 App Runtime Responsibilities

- Web app (`apps/web`) handles UI, routing, local settings, and client-side orchestration.
- Backend (`apps/backend`) handles auth, persistence, prompt construction, model invocation, and response lifecycle.
- Desktop app (`apps/desktop`) launches and supervises local services/processes and then embeds the web UI in an Electron window.

### 2.3 Core Ports and Services

Default local ports:

- Web: `3000`
- Backend: `4000`
- Postgres: host `55432` -> container `5432`
- Redis: `6379`

## 3. Product Surfaces and Navigation

Primary web routes:

- `/sign-in`: Email/password sign-in UI
- `/sign-up`: Email/password registration UI
- `/onboarding`: Introductory conversational onboarding flow
- `/chat`: Main chat workspace (sidebar, header, message list, composer)
- `/about`: Informational starter page

Route behavior:

- Root auth index route redirects to `/sign-in`.
- Chat route mounts the `ChatLanding` experience and drives most product functionality.
- Root shell applies theme and accent initialization from local storage before hydration.

## 4. Authentication and Session Model

## 4.1 Account Creation and Sign-in

Backend endpoints:

- `POST /auth/signup`
- `POST /auth/signin`

Behavior:

- Passwords are hashed with bcrypt (`salt rounds = 12`).
- Email uniqueness is enforced in PostgreSQL (`users.email UNIQUE`).
- Successful auth returns:
  - user object
  - opaque session token

## 4.2 Session Storage and Validation

- Sessions are stored in Redis under key pattern `session:<token>`.
- Session payload includes `userId` and `email`.
- Frontend stores token in `localStorage` under `lovechat_session_token`.
- Protected routes/actions send `Authorization: Bearer <token>`.
- Backend resolves session for each request through Redis lookup and payload validation.

## 5. Onboarding Experience

The onboarding page is intentionally cinematic/typed and staged:

1. Leo introduces itself in progressive message reveals.
2. User provides full name and nickname.
3. App persists onboarding profile (`POST /onboarding/profile`) with acknowledgment/completion flags.
4. Policy/expectation messaging appears with user acknowledgment controls.
5. User transitions to `/chat` after completion.

Persisted onboarding data:

- `fullName`
- `nickname`
- `acknowledged`
- `completed`

Onboarding state is cached client-side in `localStorage` as `lovechat_onboarding_profile`, then refreshed from backend when available.

## 6. Main Chat Experience

The chat screen contains four major regions:

- Left sidebar: session list, search, profile/settings/logout entrypoints
- Top header: share/export and session actions
- Message area: chat transcript, citations, charts, images, thinking indicator
- Bottom composer: prompt input, tools toggles, model selector, file uploads

## 6.1 Session Management

Features:

- Create new chat session
- Open existing session
- Fork chat from any message (branch from that point)
- Rename session
- Delete one session
- Delete all sessions (via settings)
- Session grouping by recency buckets:
  - Today
  - Previous 7 Days
  - Older
- Session search/filter in sidebar
- Active session reflected in URL query param `?session=<id>`
- Real-time generation status badge in sidebar (`queued` or `in_progress`)
- Tree-style session history in sidebar using branch depth indentation and branch markers
- Branch map entry in header (shown only when active chat is a fork)

## 6.1.1 Chat Branching (Git-like Conversation Versioning)

LoveChat now supports conversation branching for power users who want to explore alternate paths without losing the original thread.

Branching behavior:

- Every message row now exposes a `Fork chat from here` action.
- Forking creates a new chat session derived from the current one.
- The new session copies history up to the selected message index (inclusive).
- The forked session stores lineage metadata pointing to:
  - parent session ID
  - source message ID used as branch point
- New forked sessions open immediately after creation so users can continue from that branch.

UX enhancements for branch cognition and discoverability:

- Discoverability:
  - In-chat guidance banner introduces branching on active chats.
  - Header `Branches` entry is placed beside `Share` for quick access.
  - Header `Branches` entry is conditional: it appears only when the active chat is itself a fork.
- Visual branch map:
  - Dedicated branch-map modal renders a real recursive tree of session lineage.
  - Nodes are clickable to jump directly to that branch session.
- Node-level branch actions:
  - Message rows show branch-count affordances when branches exist at that exact fork point.
  - Users can open a node dialog to switch to sibling branches from that node context.
- Compare workflow:
  - Branch continuations can be compared side-by-side from the same fork point.
  - Compare view supports “Use selected branch response” to seed follow-up continuation in the active branch.
- Branch labeling and intent:
  - Fork dialog includes intent chips (for example, alternative, tone, research, debug, custom).
  - Intent is reflected in derived branch titles unless user overrides with custom title.

History model:

- Session history remains time-grouped (Today / Previous 7 Days / Older) while also carrying tree lineage.
- Sidebar rows now render branch depth, producing a tree-like visual history.
- This creates a Git-style mental model:
  - original conversation path remains intact
  - branches can diverge and continue independently

## 6.2 Message Lifecycle

For a normal prompt:

1. User submits text (+ optional files).
2. Frontend ensures an active session exists.
3. Frontend calls `POST /chat/completions`.
4. Backend creates or reuses a generation job.
5. Frontend polls `GET /chat/generations/:generationId`.
6. Partial assistant text appears progressively (typewriter stream effect).
7. Final result updates message content + citations/search flags.

If user reopens a session with an active generation:

- The frontend resumes polling using the session’s `activeGeneration` payload.

## 6.3 Rich Assistant Rendering

Assistant messages support:

- Markdown rendering
- GFM features
- Math rendering via KaTeX pipeline
- Inline/generated image display
- Citation rendering with stacked and popover behaviors
- Chart packets embedded in fenced blocks (` ```lovechat-chart `)

Chart packets are parsed out of markdown, validated against a strict schema, and rendered as chart cards.

## 6.4 Composer and Input Features

Composer capabilities include:

- Enter-to-send prompt input
- Stop generation while loading
- Model selection dropdown
- Web search toggle
- Learning mode toggle
- File upload button
- Clipboard-paste image ingestion
- File pill previews and remove actions

Per-file preview behavior:

- Images: inline preview
- PDFs: iframe preview
- Text: plain-text preview
- Unsupported formats: placeholder preview card

## 6.5 Attachments and Context Injection

Frontend parses uploads into attachment objects that may include:

- metadata (`id`, `name`, `mimeType`, `size`)
- extracted text (for text files and PDFs)
- image data URL (for image files under size limits)

Backend transforms user messages with attachments into model input by:

- appending structured attachment context to text
- adding image blocks (`input_image`) when `imageDataUrl` exists

This allows multimodal prompting with both textual and visual inputs.

## 6.6 User Message Controls

For user messages:

- Edit and save a past message
- Regenerate assistant continuation from edited point
- Copy message text
- Fork chat from this message
- If branches exist at this message node: open branch-node actions (switch or compare)

For assistant messages:

- Copy response text
- If response is image-only, attempt copy-to-clipboard image behavior
- Retry assistant response from prior turn
- Download generated images
- Add to memory (manual save trigger for durable memory)
- Fork chat from this message
- If branches exist at this message node: open branch-node actions (switch or compare)

## 6.7 Landing Mode and Prompt Suggestions

When no messages exist, chat displays:

- Dynamic greeting variants (including time/day contextual greetings)
- Topic chips:
  - Research
  - Create Images
  - How to
  - Analyze
  - Code
- Topic-specific starter prompts

Mobile shows a truncated suggestion list with “Show more” affordance.

## 6.8 Export and Sharing

Header share/export actions:

- Copy link: includes active session query param
- Export to Markdown
- Export to PDF (print document pipeline)

Markdown export includes:

- conversation transcript
- attachment summaries
- chart summaries

PDF export builds a print-friendly HTML document with:

- typography and section styles
- preserved markdown rendering
- imported runtime styles (including KaTeX styles)
- assistant/user message sections

## 6.9 Memory Capture and Management

LoveChat now includes a long-term memory subsystem that combines manual and automatic capture.

Manual capture flow:

- Triggered from assistant message actions via Add to memory
- Frontend sends memory-save request with summarize mode enabled
- Backend summarizes into short durable memory text before storage

Automatic capture flow:

- During generation, backend evaluates the latest user message
- Heuristic extraction plus AI extraction identify durable memory candidates
- Candidates are deduplicated, normalized, and stored as auto memory entries

Memory management UX:

- Memory is managed in Settings -> Data Controls
- Users can review, edit, and delete existing memory entries
- Direct memory creation in Settings is intentionally disabled
- Memory entries show source labels (manual or auto-detected)

Memory quality rules (current behavior):

- One-off task phrasing is compressed toward durable preference/fact wording
- Assistant lead-ins (for example, Certainly / Here is) are stripped
- Summaries are length-bounded for context-size and cost control
- Memory dedupe is case-insensitive and whitespace-normalized

Memory categories (current behavior):

- `identity` example: "I'm a CS student"
- `preferences` example: "I like short answers"
- `goals` example: "I'm building a startup"
- `constraints` example: "I use Next.js + TS"
- Category is inferred heuristically by backend when not explicitly provided

Memory conflict resolution (current behavior):

- New memories can override existing category peers when conflict is detected
- Preference conflicts (for example concise vs detailed) are treated as replacements, not additive duplicates
- Replacement updates existing memory content and resets embedding cache for re-indexing
- Confidence score is increased when a manual override occurs

Memory retrieval and prompt injection (current behavior):

- Backend no longer injects all stored memories into every request
- Before each generation, backend embeds the latest user message and selects top-K relevant memories
- Ranking uses a composite score: `score = relevance + importance + recency`
- Relevance comes from semantic similarity (or lexical overlap fallback)
- Importance combines a stored importance score with frequency-of-use signal
- Recency is derived from `last_used_at` with time-decay behavior
- `identity` memories are always injected
- `preferences` memories are injected as tone/style instructions
- `goals` memories are injected to steer suggestions and next steps
- `constraints` memories are injected as implementation/tool boundaries
- Selected memories are injected into the system prompt as context-aware long-term memory
- Retrieved memories update `last_used_at` and increment usage frequency counters
- Before injection, memory prompt assembly enforces a hard token budget
- Memory lines are packed in priority order until budget is exhausted (instead of injecting all selected items)
- Session scope is respected: retrieval uses global memory plus same-session memory

## 7. AI Orchestration and Model Behavior

## 7.1 Model Resolution Rules

Backend resolves generation model using request model + heuristics:

- If requested model is a likely OpenAI text model and latest user prompt looks like image-generation intent, backend switches to configured image model (`OPENAI_IMAGE_MODEL`, default `gpt-image-1`).
- Otherwise backend uses resolved text model.

This means image prompts can automatically route to image generation flow.

## 7.2 Text vs Image Generation Paths

Text path:

- Uses OpenAI Responses API with composed system + user input
- Enables web-search tool when requested/applicable
- Streams output deltas when possible
- Falls back to non-streaming call if stream fails
- Extracts:
  - answer text
  - citations
  - searched-web signal
  - model “thinking” summary snippets

Image path:

- Uses OpenAI Images API `generate`
- Uses latest user message as prompt
- Requests `1024x1024`
- Tries configured image model, falls back to `gpt-image-1` when model is unavailable
- Converts returned image URLs/base64 into markdown image blocks for UI rendering

## 7.3 System Prompt Stack

Completion input can include multiple layered system prompts:

- Personalized prompt built from user profile and tone settings
- Long-term memory prompt built from stored user memories
- Visualization instruction prompt (forces chart packet format for analytical requests)
- Learning mode tutoring prompt (if enabled)
- Web search grounding prompt (if enabled)

## 7.4 Learning Mode

Learning mode changes assistant behavior to tutor-like guidance:

- Emphasizes Socratic method
- Avoids giving direct answer first
- Limits number of guiding questions
- Uses scaffolding and adaptive instruction
- Ends with a prompt that hands control back to user

## 7.5 Web Search Integration

Web search activation happens via either:

- explicit UI toggle (`useWebSearch`), or
- keyword heuristic in latest user message (`research` or `search`)

When activated for text generation:

- backend includes web-search tool
- backend extracts source metadata and annotations into normalized citation objects
- frontend displays citations as interactive source chips/cards

## 7.6 Chart Packet Protocol

Assistant can emit fenced packets:

- fence label: `lovechat-chart`
- payload: strict JSON schema (`version`, `component`, `chartType`, axis definitions, series, optional actions)

Frontend parser:

- strips valid packets from markdown
- validates packets with zod
- renders charts via `ChartCard`
- keeps non-chart markdown text alongside charts

## 7.7 Automatic Memory Inference

Automatic memory inference currently runs per generation against the latest user message.

Pipeline:

1. Normalize latest user message to plain text.
2. Run heuristic memory candidate extraction.
3. Run AI memory extraction (small model) for durable memory candidates.
4. Parse and validate candidate strings.
5. Deduplicate candidates and cap count.
6. Upsert candidates to `user_memories` with source `auto`.

Memory retrieval for generation context runs after inference/upsert.

Retrieval pipeline:

1. Load recent memory candidates for the user.
2. Embed the latest user message.
3. Ensure memory embeddings exist (generate and cache when missing/stale).
4. Compute relevance per candidate (cosine similarity, or lexical overlap fallback).
5. Compute importance and recency components for each candidate.
6. Rank by composite score: `score = relevance + importance + recency` and select top-K.
7. Update usage metadata (`last_used_at`, usage count) for selected memories.
8. Estimate token size per memory and pack entries until memory token budget is reached.
9. Inject packed memories into the long-term memory system prompt block.

Temporal behavior:

- Non-identity memory can expire via `expires_at`
- Scoring includes temporal decay on importance (category-specific half-life)
- Expired memory is excluded from retrieval context

Feedback loop:

- Memory quality can be tuned via explicit feedback endpoint
- Positive feedback increases importance/confidence scores
- Negative feedback decreases importance/confidence scores

Selection intent:

- Include durable identity facts, preferences, recurring constraints, and ongoing goals.
- Exclude temporary one-off asks whenever possible.

## 8. Data Model and Persistence

## 8.1 Database Tables

`users`

- `id`, `email`, `password_hash`, `chat_history_enabled`, `created_at`

`onboarding_profiles`

- one-to-one with users (`user_id` PK)
- identity info and avatar
- personalization controls (`base_style_tone`, warmth/enthusiasm/headers/emojis levels)
- custom instruction fields and profile metadata
- onboarding acknowledgment/completion timestamps

`chat_conversations`

- `id` (UUID), `user_id`, title, timestamps
- `parent_conversation_id` (nullable UUID, self-reference to parent conversation)
- `forked_from_message_id` (nullable BIGINT, references branch-point message)

`chat_messages`

- linked to conversation + user
- role (`user`/`assistant`)
- content
- model
- attachments JSON
- citations JSON
- searched_web flag
- thinking_text

`chat_generations`

- generation job record by UUID
- status (`queued`, `in_progress`, `completed`, `failed`)
- request metadata (model, flags, input messages)
- response state (text, citations, search flag, thinking, error)
- completion timestamps

`user_memories`

- `id` (UUID), `user_id`
- `content` (stored durable memory text)
- `content_normalized` (dedupe key)
- `source` (`manual` or `auto`)
- `memory_type` (`identity`, `preferences`, `goals`, `constraints`)
- `scope_type` (`global`, `session`)
- `session_id` (set for session-scoped memory)
- `confidence_score` (confidence for conflict handling and ranking)
- `expires_at` (optional expiry timestamp)
- `importance_score` (stored importance prior for ranking)
- `usage_count` (frequency of retrieval/use)
- `embedding_model` (embedding model used for cached vector)
- `embedding_json` (cached embedding vector)
- `embedding_updated_at` (when embedding cache was last refreshed)
- `created_at`, `updated_at`, `last_used_at`

## 8.2 Chat History Control

`users.chat_history_enabled` determines persistence behavior:

- When true: full conversation messages are persisted.
- When false: generation may complete, but backend schedules conversation cleanup (ephemeral style behavior).

## 8.3 Redis Usage

Redis is used for:

- auth session storage and lookup
- TTL-based session expiration (`SESSION_TTL_SECONDS`)

## 9. API Surface (Detailed)

### 9.1 Health

- `GET /health`
  - Checks PostgreSQL and Redis connectivity
  - Returns service statuses and timestamp

### 9.2 Auth

- `POST /auth/signup`
  - Body: `email`, `password`
  - Returns user + token
- `POST /auth/signin`
  - Body: `email`, `password`
  - Returns user + token

### 9.3 Account Profile

- `GET /account/profile`
  - Returns account + personalization profile
- `PATCH /account/profile`
  - Updates email, identity fields, tone controls, custom instructions, avatar

### 9.4 Data Controls

- `GET /account/data-controls`
  - Returns `chatHistoryEnabled`
- `PATCH /account/data-controls`
  - Updates `chatHistoryEnabled`

### 9.5 Data Export and Account Deletion

- `GET /account/export`
  - Returns structured export payload with account/profile/sessions/messages/memories
- `DELETE /account`
  - Deletes user and dependent data, invalidates session token

### 9.6 Onboarding

- `POST /onboarding/profile`
  - Upserts onboarding identity + ack/completion state
- `GET /onboarding/profile`
  - Reads onboarding profile

### 9.7 Chat Sessions

- `GET /chat/sessions`
  - Lists sessions + active generation status hints
  - Includes lineage metadata (`parentSessionId`, `forkedFromMessageId`)
- `POST /chat/sessions`
  - Creates new session
- `DELETE /chat/sessions`
  - Deletes all user sessions
- `GET /chat/sessions/:sessionId`
  - Returns session metadata, message history, optional active generation snapshot
  - Includes lineage metadata (`parentSessionId`, `forkedFromMessageId`)
  - Includes stable `messageId` per persisted message row for node-level branch UX
- `PATCH /chat/sessions/:sessionId`
  - Renames session
- `DELETE /chat/sessions/:sessionId`
  - Deletes one session
- `POST /chat/sessions/:sessionId/fork`
  - Creates a forked session from a source session
  - Accepts optional `messageIndex` (fork point) and optional `title`
  - Copies messages from start through fork point into the new session
  - Returns the created forked session metadata
  - Used by intent-labeled fork UI where title can be generated from selected branch intent

### 9.8 Chat Generation

- `POST /chat/completions`
  - Starts or resumes generation workflow
  - Accepts model, flags, optional session ID, and message history
  - Returns generation ID + status + resolved session metadata
- `GET /chat/generations/:generationId`
  - Poll endpoint for generation progress/final output/errors

### 9.9 Memory

- `GET /memory`
  - Returns current long-term memory entries
- `POST /memory`
  - Creates or upserts memory entry
  - Accepts optional `category` (`identity`, `preferences`, `goals`, `constraints`)
  - Accepts optional `scope` (`global`, `session`), `chatSessionId`, and `expiresAt`
  - Supports optional summarize flags/modes for compressed durable memory storage
- `PATCH /memory/:memoryId`
  - Updates memory content
  - Accepts optional `category` to reclassify memory type
- `POST /memory/:memoryId/feedback`
  - Accepts `feedback` (`up` or `down`) to tune memory importance/confidence
- `DELETE /memory/:memoryId`
  - Deletes memory entry

## 10. Personalization and UX Configuration

## 10.1 Style/Tone Profile

Users can tune assistant personality with:

- Base style tone (`default`, `professional`, `friendly`, `candid`, `quirky`, `efficient`, `nerdy`, `cynical`)
- Warmth level
- Enthusiasm level
- Header/formatting density
- Emoji usage level
- Custom free-form instruction text

These settings are transformed into system prompt directives at generation time.

## 10.2 Theme and Accent

Client-side settings include:

- Theme mode: `light`, `dark`, `auto`
- Accent colors: default, blue, violet, pink, rose, green, orange

Theme/accent are applied at root document startup from local storage to avoid flashing and hydration mismatch.

## 10.3 Models Panel

Settings dialog includes model management:

- Visibility toggles for built-in OpenAI models
- Optional Ollama integration:
  - Enable/disable local provider
  - Configure Ollama base URL
  - Fetch available local models from `/api/tags`
  - Add fetched models into selector with visibility defaults

Built-in OpenAI model entries include variants such as `gpt-5.4`, `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `o3`, and `o4-mini`.

## 11. Citation and Safety-Adjacent Rendering

Citation model includes fields like:

- `href`, `title`, `domain`, `favicon`, optional author/date/type metadata

Citation UI supports:

- default and inline citation variants
- stacked variant with compact source avatar icons and overflow popovers
- safe navigation helper paths for outgoing links

Backend tries to normalize favicon URLs and domains, and provides fallback icon URLs via DuckDuckGo favicon service.

## 12. Desktop App Behavior

Electron desktop app startup sequence:

1. Ensure backend `.env` exists (copy from `.env.example` if missing).
2. Attempt `docker compose up -d postgres redis`.
3. Check whether backend/web are already reachable.
4. If missing and ports are free, spawn `pnpm` dev processes for backend and web.
5. Wait for both ports to become reachable.
6. Load the web URL inside Electron window.

Safety behaviors:

- Detects port collisions and shows actionable error if occupied.
- Tracks child processes and terminates them on app quit.
- Shows startup failure dialog if dependencies cannot become ready.

## 13. Docker and Local Infra

`docker-compose.yml` provisions:

- PostgreSQL 17 Alpine with persistent volume
- Redis 8 Alpine with persistent volume
- Health checks for both services

This allows local backend persistence/session management with minimal setup.

## 14. Error Handling and Resilience Patterns

Across frontend and backend:

- Zod validation on input payloads and route params
- Consistent 401/404/409/500-style API responses
- Frontend fallback messages when JSON parse fails on error payloads
- Poll retry scheduling on transient generation poll failures
- Assistant timeout handling with abort controller
- Streaming fallback to non-streaming API call when needed
- Image model fallback when configured image model is unavailable

## 15. Security and Boundary Notes

Current implementation includes:

- Session token auth via bearer tokens
- Password hashing via bcrypt
- Input validation via zod schemas
- CORS locked to configured `WEB_ORIGIN`

Important practical note:

- Sign-in/sign-up pages contain social buttons visually, but active auth wiring is email/password in backend routes shown above.

## 16. Current Functional Scope Summary

LoveChat is currently a feature-rich AI chat platform with:

- robust account/session layer
- personalized conversational behavior
- rich content rendering pipeline
- charts and citations
- local model extensibility via Ollama
- full chat/session lifecycle management
- export/data-control/account-governance features
- web + backend + desktop operation modes

In short: it is not just a basic chatbot UI. It is a full product stack for personalized, persistent, multi-session AI work with strong UX polish and a growing feature foundation.