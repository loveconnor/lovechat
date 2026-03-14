export type Badge = {
  label: string
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow'
}

export type ModelDetail = {
  provider: string
  context: string
  desc: string
  strengths: string[]
  useCases: string
}

export type ModelEntry = {
  key: string
  title: string
  desc: string
  context: string
  badges: Badge[]
  details: ModelDetail
}

export type Provider = {
  key: string
  label: string
  models: ModelEntry[]
}

export type OllamaModel = {
  key: string
  title: string
}

export type ModelSettings = {
  visibility: Record<string, boolean>
  ollama: {
    enabled: boolean
    url: string
    models: OllamaModel[]
    lastSyncedAt: number | null
  }
}

const MODEL_SETTINGS_STORAGE_KEY = 'lovechat_model_settings_v1'
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
export const MODEL_SETTINGS_UPDATED_EVENT = 'lovechat:model-settings-updated'

const OPENAI_MODELS: ModelEntry[] = [
  {
    key: 'gpt-5.4',
    title: 'GPT-5.4',
    desc: 'OpenAI’s latest flagship model for complex reasoning and coding.',
    context: '1M Context',
    badges: [{ label: 'Flagship', color: 'purple' }],
    details: {
      provider: 'OpenAI',
      context: '1,000,000 tokens',
      desc: 'GPT-5.4 is OpenAI’s newest frontier model designed for complex reasoning, coding, and AI agents. It supports massive context windows and native computer-use capabilities.',
      strengths: [
        'Best reasoning and coding performance',
        'Massive long-context support',
        'Agent workflows and tool usage',
      ],
      useCases:
        'AI agents, complex reasoning, large codebases, professional workflows.',
    },
  },
  {
    key: 'gpt-5',
    title: 'GPT-5',
    desc: 'High-intelligence model for coding and advanced logic.',
    context: '400k Context',
    badges: [{ label: 'Advanced', color: 'blue' }],
    details: {
      provider: 'OpenAI',
      context: '400,000 tokens',
      desc: 'GPT-5 is a powerful model for complex reasoning, coding, and agentic workflows. It supports configurable reasoning effort for deeper problem solving.',
      strengths: [
        'Advanced reasoning',
        'Excellent coding ability',
        'Tool and agent workflows',
      ],
      useCases:
        'Engineering tasks, research, complex analysis.',
    },
  },
  {
    key: 'gpt-5-mini',
    title: 'GPT-5 Mini',
    desc: 'Balanced model with strong reasoning at lower cost.',
    context: '400k Context',
    badges: [{ label: 'Balanced', color: 'green' }],
    details: {
      provider: 'OpenAI',
      context: '400,000 tokens',
      desc: 'GPT-5 Mini provides strong reasoning capabilities at significantly lower cost and latency than the full GPT-5 model.',
      strengths: [
        'Good reasoning performance',
        'Faster and cheaper than GPT-5',
        'Strong conversational ability',
      ],
      useCases:
        'Chatbots, SaaS assistants, business workflows.',
    },
  },
  {
    key: 'gpt-5-nano',
    title: 'GPT-5 Nano',
    desc: 'Ultra-fast, low-cost model for simple AI tasks.',
    context: '400k Context',
    badges: [{ label: 'Cheap', color: 'yellow' }],
    details: {
      provider: 'OpenAI',
      context: '400,000 tokens',
      desc: 'GPT-5 Nano is the fastest and cheapest GPT-5 model, optimized for simple and high-volume tasks.',
      strengths: [
        'Very low cost',
        'Fast inference',
        'Efficient for repeated tasks',
      ],
      useCases:
        'Classification, summarization, tagging, lightweight assistants.',
    },
  },
  {
    key: 'o3',
    title: 'o3',
    desc: 'Advanced reasoning model for complex problem solving.',
    context: '200k Context',
    badges: [{ label: 'Reasoning', color: 'orange' }],
    details: {
      provider: 'OpenAI',
      context: '200,000 tokens',
      desc: 'o3 is a specialized reasoning model designed for complex multi-step logic and analysis.',
      strengths: [
        'Deep reasoning',
        'Step-by-step analysis',
        'Strong math and logic ability',
      ],
      useCases:
        'Math, planning, research, advanced reasoning.',
    },
  },
  {
    key: 'o4-mini',
    title: 'o4-mini',
    desc: 'Fast reasoning model optimized for efficiency.',
    context: '200k Context',
    badges: [{ label: 'Reasoning', color: 'orange' }, { label: 'Fast', color: 'green' }],
    details: {
      provider: 'OpenAI',
      context: '200,000 tokens',
      desc: 'o4-mini is a lightweight reasoning model optimized for speed and cost.',
      strengths: [
        'Fast reasoning',
        'Lower cost',
        'Efficient multi-step logic',
      ],
      useCases:
        'Planning tasks, analysis pipelines, logic-heavy automation.',
    },
  },
]

export const BUILTIN_PROVIDERS: Provider[] = [
  {
    key: 'openai',
    label: 'OpenAI',
    models: OPENAI_MODELS,
  },
]

function toLocalModel(model: OllamaModel): ModelEntry {
  return {
    key: model.key,
    title: model.title,
    desc: 'Locally hosted model served by Ollama.',
    context: 'Local',
    badges: [{ label: 'Local', color: 'green' }],
    details: {
      provider: 'Ollama',
      context: 'Varies by model',
      desc: `This model is served by your local Ollama instance (${model.title}).`,
      strengths: [
        'Runs fully on your machine',
        'Private local inference',
        'No external API required',
      ],
      useCases:
        'Offline chat, local prototyping, and privacy-sensitive workflows.',
    },
  }
}

export function flattenProviders(providers: Provider[]) {
  return providers.flatMap((provider) => provider.models)
}

export function getDefaultVisibility() {
  return Object.fromEntries(flattenProviders(BUILTIN_PROVIDERS).map((model) => [model.key, true]))
}

export function createDefaultModelSettings(): ModelSettings {
  return {
    visibility: getDefaultVisibility(),
    ollama: {
      enabled: false,
      url: DEFAULT_OLLAMA_URL,
      models: [],
      lastSyncedAt: null,
    },
  }
}

function normalizeSettings(value: unknown): ModelSettings {
  const defaults = createDefaultModelSettings()
  if (!value || typeof value !== 'object') {
    return defaults
  }

  const raw = value as {
    visibility?: Record<string, unknown>
    ollama?: {
      enabled?: unknown
      url?: unknown
      models?: unknown
      lastSyncedAt?: unknown
    }
  }

  const visibilityEntries = Object.entries(raw.visibility ?? {}).filter((entry): entry is [string, boolean] => {
    const [key, enabled] = entry
    return typeof key === 'string' && typeof enabled === 'boolean'
  })

  const parsedOllamaModels = Array.isArray(raw.ollama?.models)
    ? raw.ollama.models
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const maybeModel = item as { key?: unknown; title?: unknown }
        if (typeof maybeModel.key !== 'string' || typeof maybeModel.title !== 'string') {
          return null
        }

        return {
          key: maybeModel.key,
          title: maybeModel.title,
        }
      })
      .filter((item): item is OllamaModel => item !== null)
    : []

  return {
    visibility: {
      ...defaults.visibility,
      ...Object.fromEntries(visibilityEntries),
    },
    ollama: {
      enabled: typeof raw.ollama?.enabled === 'boolean' ? raw.ollama.enabled : defaults.ollama.enabled,
      url: typeof raw.ollama?.url === 'string' && raw.ollama.url.trim().length > 0
        ? raw.ollama.url
        : defaults.ollama.url,
      models: parsedOllamaModels,
      lastSyncedAt: typeof raw.ollama?.lastSyncedAt === 'number' ? raw.ollama.lastSyncedAt : null,
    },
  }
}

export function loadModelSettings(): ModelSettings {
  if (typeof window === 'undefined') {
    return createDefaultModelSettings()
  }

  const raw = window.localStorage.getItem(MODEL_SETTINGS_STORAGE_KEY)
  if (!raw) {
    return createDefaultModelSettings()
  }

  try {
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return createDefaultModelSettings()
  }
}

export function saveModelSettings(nextSettings: ModelSettings) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(MODEL_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
  window.dispatchEvent(new CustomEvent(MODEL_SETTINGS_UPDATED_EVENT, { detail: nextSettings }))
}

export function getAllConfiguredProviders(settings: ModelSettings): Provider[] {
  const providers: Provider[] = [...BUILTIN_PROVIDERS]

  if (settings.ollama.models.length > 0) {
    providers.push({
      key: 'ollama',
      label: 'Ollama',
      models: settings.ollama.models.map(toLocalModel),
    })
  }

  return providers
}

export function getVisibleProviders(settings: ModelSettings): Provider[] {
  const providers = getAllConfiguredProviders(settings)
  return providers
    .map((provider) => ({
      ...provider,
      models: provider.models.filter((model) => settings.visibility[model.key] ?? true),
    }))
    .filter((provider) => provider.models.length > 0)
}

export async function fetchOllamaModels(baseUrl: string) {
  const normalizedUrl = baseUrl.replace(/\/+$/, '')
  const response = await fetch(`${normalizedUrl}/api/tags`)

  if (!response.ok) {
    let errorMessage = `Failed to fetch models (${response.status})`
    try {
      const payload = (await response.json()) as { error?: string; message?: string }
      errorMessage = payload.error ?? payload.message ?? errorMessage
    } catch {
      // Keep fallback message.
    }

    throw new Error(errorMessage)
  }

  const payload = (await response.json()) as { models?: Array<{ name?: string }> }
  const rawModels = Array.isArray(payload.models) ? payload.models : []
  const models = rawModels
    .map((entry) => entry.name)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map((name) => ({
      key: `ollama:${name}`,
      title: name,
    }))

  return models
}
