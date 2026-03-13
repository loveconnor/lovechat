import { useEffect, useMemo, useRef } from 'react'
import type { ECharts, EChartsOption } from 'echarts'
import type { ChartAction, ChartBlueprint } from '#/components/ai/visualization/schema'

type ChartCardProps = {
  chart: ChartBlueprint
  onAction?: (action: ChartAction) => void
  actionsDisabled?: boolean
}

function formatNumber(value: number, mode: ChartBlueprint['yAxis']['format']) {
  if (mode === 'currency') {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  }

  if (mode === 'percent') {
    return `${value.toFixed(2)}%`
  }

  return new Intl.NumberFormat().format(value)
}

function toChartOption(chart: ChartBlueprint): EChartsOption {
  const isScatter = chart.chartType === 'scatter'
  const yAxisFormat = chart.yAxis.format

  const series = chart.series.map((entry, seriesIndex) => {
    const normalizedData = chart.xAxis.categories.map((_, pointIndex) => entry.data[pointIndex] ?? null)

    if (isScatter) {
      return {
        name: entry.name,
        type: 'scatter' as const,
        symbolSize: 9,
        itemStyle: entry.color ? { color: entry.color } : undefined,
        data: chart.xAxis.categories.map((category, pointIndex) => [category, normalizedData[pointIndex]]),
      }
    }

    const isArea = chart.chartType === 'area'
    const defaultPalette = chart.theme?.palette?.[seriesIndex]

    return {
      name: entry.name,
      type: chart.chartType === 'bar' ? ('bar' as const) : ('line' as const),
      smooth: chart.chartType !== 'bar',
      barMaxWidth: chart.chartType === 'bar' ? 34 : undefined,
      areaStyle: isArea ? { opacity: 0.22 } : undefined,
      lineStyle: chart.chartType === 'bar' ? undefined : { width: 2.5 },
      itemStyle: entry.color || defaultPalette ? { color: entry.color ?? defaultPalette } : undefined,
      emphasis: {
        focus: 'series' as const,
      },
      data: normalizedData,
    }
  })

  return {
    animationDuration: 450,
    animationDurationUpdate: 350,
    color: chart.theme?.palette,
    grid: {
      top: 16,
      right: 16,
      bottom: 30,
      left: 40,
      containLabel: true,
    },
    legend: {
      top: 2,
      type: 'scroll',
      selectedMode: true,
    },
    tooltip: {
      trigger: isScatter ? 'item' : 'axis',
      borderRadius: 10,
      valueFormatter: (value: number | string) => {
        const numeric = typeof value === 'number' ? value : Number(value)
        if (!Number.isFinite(numeric)) {
          return String(value)
        }

        return formatNumber(numeric, yAxisFormat)
      },
    },
    xAxis: {
      type: 'category',
      name: chart.xAxis.label,
      nameLocation: 'middle',
      nameGap: 24,
      boundaryGap: chart.chartType === 'bar',
      data: chart.xAxis.categories,
      axisLabel: {
        interval: 'auto',
      },
    },
    yAxis: {
      type: 'value',
      name: chart.yAxis.label,
      scale: true,
      axisLabel: {
        formatter: (value: number) => formatNumber(value, yAxisFormat),
      },
      splitLine: {
        lineStyle: {
          opacity: 0.28,
        },
      },
    },
    series,
  }
}

export function ChartCard({ chart, onAction, actionsDisabled = false }: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartInstanceRef = useRef<ECharts | null>(null)
  const option = useMemo(() => toChartOption(chart), [chart])

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null
    let activeInstance: ECharts | null = null
    let cancelled = false

    const mountChart = async () => {
      const container = containerRef.current
      if (!container) {
        return
      }

      const echarts = await import('echarts')
      if (cancelled || !containerRef.current) {
        return
      }

      activeInstance = echarts.init(containerRef.current)
      chartInstanceRef.current = activeInstance
      activeInstance.setOption(option)

      resizeObserver = new ResizeObserver(() => {
        activeInstance?.resize()
      })

      resizeObserver.observe(containerRef.current)
    }

    void mountChart()

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      activeInstance?.dispose()
      chartInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    chartInstanceRef.current?.setOption(option, true)
  }, [option])

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#252525]">
      <header className="mb-3">
        <h3 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">{chart.title}</h3>
        {chart.description ? (
          <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-300">{chart.description}</p>
        ) : null}
      </header>

      <div ref={containerRef} className="h-72 w-full" aria-label={`Chart: ${chart.title}`} />

      {chart.actions && chart.actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chart.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction?.(action)}
              disabled={actionsDisabled}
              className="rounded-lg border border-black/10 bg-gray-100 px-3 py-1.5 text-[12px] font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-200 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/8 dark:text-gray-200 dark:hover:bg-white/14"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
