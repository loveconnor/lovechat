import { Pool } from 'pg'
import { env } from '../config/env.js'

export const pgPool = new Pool({
  connectionString: env.POSTGRES_URL,
})

export async function checkPostgresConnection() {
  await pgPool.query('SELECT 1')
}

export async function initializeDatabase() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      chat_history_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pgPool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS chat_history_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `)

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_profiles (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatar_url TEXT,
      base_style_tone TEXT NOT NULL DEFAULT 'default',
      warmth_level TEXT NOT NULL DEFAULT 'default',
      enthusiasm_level TEXT NOT NULL DEFAULT 'default',
      headers_level TEXT NOT NULL DEFAULT 'default',
      emojis_level TEXT NOT NULL DEFAULT 'default',
      custom_instructions TEXT,
      occupation TEXT,
      more_about_you TEXT,
      acknowledged_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS base_style_tone TEXT NOT NULL DEFAULT 'default'
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS warmth_level TEXT NOT NULL DEFAULT 'default'
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS enthusiasm_level TEXT NOT NULL DEFAULT 'default'
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS headers_level TEXT NOT NULL DEFAULT 'default'
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS emojis_level TEXT NOT NULL DEFAULT 'default'
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS custom_instructions TEXT
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS occupation TEXT
  `)

  await pgPool.query(`
    ALTER TABLE onboarding_profiles
    ADD COLUMN IF NOT EXISTS more_about_you TEXT
  `)

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id UUID PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
    ON chat_conversations (user_id, updated_at DESC)
  `)

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      model TEXT,
      attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      memory_context_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      searched_web BOOLEAN NOT NULL DEFAULT FALSE,
      thinking_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pgPool.query(`
    ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb
  `)

  await pgPool.query(`
    ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS citations_json JSONB NOT NULL DEFAULT '[]'::jsonb
  `)

  await pgPool.query(`
    ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS memory_context_json JSONB NOT NULL DEFAULT '[]'::jsonb
  `)

  await pgPool.query(`
    ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS searched_web BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await pgPool.query(`
    ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS thinking_text TEXT
  `)

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS chat_generations (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model TEXT NOT NULL,
      use_web_search BOOLEAN NOT NULL DEFAULT FALSE,
      use_learning_mode BOOLEAN NOT NULL DEFAULT FALSE,
      input_messages_json JSONB NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'in_progress', 'completed', 'failed')),
      response_text TEXT NOT NULL DEFAULT '',
      citations_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      memory_context_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      searched_web BOOLEAN NOT NULL DEFAULT FALSE,
      thinking_text TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `)

  await pgPool.query(`
    ALTER TABLE chat_generations
    ADD COLUMN IF NOT EXISTS memory_context_json JSONB NOT NULL DEFAULT '[]'::jsonb
  `)

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_generations_conversation_status
    ON chat_generations (conversation_id, status, updated_at DESC)
  `)

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_generations_user_created
    ON chat_generations (user_id, created_at DESC)
  `)

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
    ON chat_messages (conversation_id, created_at)
  `)

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_memories (
      id UUID PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      content_normalized TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('manual', 'auto')),
      memory_type TEXT NOT NULL DEFAULT 'constraints' CHECK (memory_type IN ('identity', 'preferences', 'goals', 'constraints')),
      scope_type TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'session')),
      session_id UUID,
      confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.6,
      expires_at TIMESTAMPTZ,
      importance_score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS content_normalized TEXT
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS embedding_model TEXT
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS embedding_json JSONB
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS importance_score DOUBLE PRECISION NOT NULL DEFAULT 0.5
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'global'
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS session_id UUID
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.6
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    DROP CONSTRAINT IF EXISTS user_memories_scope_type_check
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD CONSTRAINT user_memories_scope_type_check CHECK (scope_type IN ('global', 'session'))
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ADD COLUMN IF NOT EXISTS memory_type TEXT NOT NULL DEFAULT 'constraints'
  `)

  await pgPool.query(`
    UPDATE user_memories
    SET importance_score = 0.5
    WHERE importance_score IS NULL
  `)

  await pgPool.query(`
    UPDATE user_memories
    SET usage_count = 0
    WHERE usage_count IS NULL
  `)

  await pgPool.query(`
    UPDATE user_memories
    SET content_normalized = lower(regexp_replace(trim(content), '\\s+', ' ', 'g'))
    WHERE content_normalized IS NULL OR content_normalized = ''
  `)

  await pgPool.query(`
    ALTER TABLE user_memories
    ALTER COLUMN content_normalized SET NOT NULL
  `)

  await pgPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memories_user_content
    ON user_memories (user_id, content_normalized)
  `)

  await pgPool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_memories_user_updated
    ON user_memories (user_id, updated_at DESC)
  `)
}