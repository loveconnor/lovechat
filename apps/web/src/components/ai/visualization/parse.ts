import { chartBlueprintSchema } from '#/components/ai/visualization/schema'
import type { ChartBlueprint } from '#/components/ai/visualization/schema'

const chartFenceRegex = /```lovechat-chart\s*([\s\S]*?)```/gi
const danglingChartFence = '```lovechat-chart'

export type ParsedVisualizationContent = {
  markdown: string
  charts: ChartBlueprint[]
}

export function parseVisualizationContent(input: string): ParsedVisualizationContent {
  if (!input.trim()) {
    return {
      markdown: '',
      charts: [],
    }
  }

  const charts: ChartBlueprint[] = []

  const withoutCompleteFences = input.replace(chartFenceRegex, (_match, jsonPayload: string) => {
    try {
      const parsed = JSON.parse(jsonPayload) as unknown
      const result = chartBlueprintSchema.safeParse(parsed)
      if (result.success) {
        charts.push(result.data)
      }
    } catch {
      // Ignore invalid JSON packets and keep rendering text only.
    }

    return ''
  })

  const normalizedLower = withoutCompleteFences.toLowerCase()
  const danglingIndex = normalizedLower.indexOf(danglingChartFence)
  const withoutDanglingFence =
    danglingIndex >= 0 ? withoutCompleteFences.slice(0, danglingIndex) : withoutCompleteFences

  const markdown = withoutDanglingFence.replace(/\n{3,}/g, '\n\n').trim()

  return {
    markdown,
    charts,
  }
}
