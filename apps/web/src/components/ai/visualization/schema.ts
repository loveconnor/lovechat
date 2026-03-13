import { z } from 'zod'

export const chartTypeSchema = z.enum(['line', 'bar', 'area', 'scatter'])

export const chartValueFormatSchema = z.enum(['number', 'currency', 'percent'])

export const chartSeriesSchema = z.object({
  name: z.string().trim().min(1).max(120),
  data: z.array(z.number().finite()).min(1).max(500),
  color: z.string().trim().min(1).max(40).optional(),
})

export const chartActionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(2_000),
})

export const chartBlueprintSchema = z.object({
  version: z.literal(1),
  component: z.literal('RenderChart'),
  chartType: chartTypeSchema,
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(600).optional(),
  xAxis: z.object({
    label: z.string().trim().min(1).max(120),
    categories: z.array(z.string().trim().min(1).max(80)).min(1).max(500),
  }),
  yAxis: z.object({
    label: z.string().trim().min(1).max(120),
    format: chartValueFormatSchema.optional(),
  }),
  series: z.array(chartSeriesSchema).min(1).max(8),
  theme: z
    .object({
      palette: z.array(z.string().trim().min(1).max(40)).min(1).max(12).optional(),
    })
    .optional(),
  actions: z.array(chartActionSchema).max(6).optional(),
})

export type ChartBlueprint = z.infer<typeof chartBlueprintSchema>
export type ChartAction = z.infer<typeof chartActionSchema>
