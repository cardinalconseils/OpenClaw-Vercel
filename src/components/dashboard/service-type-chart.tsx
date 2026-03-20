'use client'

import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'

const chartConfig: ChartConfig = {
  count: { label: 'Calls', color: 'var(--color-primary)' },
}

interface ServiceTypeChartProps {
  data: { type: string; count: number }[]
}

export function ServiceTypeChart({ data }: ServiceTypeChartProps) {
  if (data.length === 0) return null

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <XAxis
          dataKey="type"
          tickLine={false}
          axisLine={false}
          className="text-muted"
        />
        <YAxis tickLine={false} axisLine={false} className="text-muted" />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
