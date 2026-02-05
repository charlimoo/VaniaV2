"use client";

import {
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  cn,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  type ChartConfig,
} from "./_ui";
import type { ChartProps } from "./schema";

// [FIX] Use vibrant hex colors as default to ensure visibility in dark mode
// These replace the CSS variables which might be missing or dark
const DEFAULT_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#84cc16", // Lime
];

export function Chart({
  surfaceId,
  type,
  title,
  description,
  data,
  xKey,
  series,
  colors,
  showLegend = true,
  showGrid = true,
  className,
  onDataPointClick,
}: ChartProps) {
  const palette = colors?.length ? colors : DEFAULT_COLORS;
  
  // --- CONFIG GENERATION ---
  let chartConfig: ChartConfig = {};

  if (type === "pie") {
    data.forEach((item, index) => {
      const label = String(item[xKey]);
      chartConfig[label] = {
        label: label,
        color: palette[index % palette.length],
      };
    });
  } else {
    const seriesColors = series.map((s, i) => s.color ?? palette[i % palette.length]);
    chartConfig = Object.fromEntries(
      series.map((s, i) => [
        s.key,
        {
          label: s.label,
          color: seriesColors[i],
        },
      ]),
    );
  }

  const handleDataPointClick = (
    seriesKey: string,
    seriesLabel: string,
    payload: Record<string, unknown>,
    index: number,
  ) => {
    onDataPointClick?.({
      seriesKey,
      seriesLabel,
      xValue: payload[xKey],
      yValue: payload[seriesKey],
      index,
      payload,
    });
  };

  // --- RENDER CONTENT ---
  let chartContent;

  if (type === "pie") {
    const valueKey = series[0].key;
    const nameKey = xKey;
    
    // [FIX] Logic to hide legend if too many items to prevent UI clutter
    const shouldShowLegend = showLegend && data.length <= 6;

    chartContent = (
      <ChartContainer
        config={chartConfig}
        className="min-h-[250px] w-full aspect-square max-h-[350px] mx-auto pb-0"
        data-surface-id={surfaceId}
      >
        <PieChart>
          <ChartTooltip 
            cursor={false} 
            content={<ChartTooltipContent hideLabel />} 
          />
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={60} 
            outerRadius={100} // Increased size
            strokeWidth={3}   // Thicker separation
            paddingAngle={2}
            onClick={(data, index) => 
              handleDataPointClick(valueKey, String(data.name), data.payload, index)
            }
            cursor={onDataPointClick ? "pointer" : undefined}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={palette[index % palette.length]}
                stroke="hsl(var(--card))" // Match card background for cleaner cutouts
              />
            ))}
          </Pie>
          {shouldShowLegend && (
            <ChartLegend 
              content={<ChartLegendContent nameKey={nameKey} />} 
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          )}
        </PieChart>
      </ChartContainer>
    );
  } else {
    const ChartComponent = type === "bar" ? BarChart : LineChart;
    const seriesColors = series.map((s, i) => s.color ?? palette[i % palette.length]);

    chartContent = (
      <ChartContainer
        config={chartConfig}
        className="min-h-[200px] w-full"
        data-surface-id={surfaceId}
      >
        <ChartComponent data={data} accessibilityLayer>
          {showGrid && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
          <XAxis
            dataKey={xKey}
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => String(value).slice(0, 10)} 
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={10} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {showLegend && <ChartLegend content={<ChartLegendContent />} />}

          {type === "bar" &&
            series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={seriesColors[i]}
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
                onClick={(data) =>
                  handleDataPointClick(s.key, s.label, data.payload, data.index)
                }
                cursor={onDataPointClick ? "pointer" : undefined}
              />
            ))}

          {type === "line" &&
            series.map((s, i) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={seriesColors[i]}
                strokeWidth={2}
                dot={{ r: 4, cursor: onDataPointClick ? "pointer" : undefined }}
                activeDot={{
                  r: 6,
                  cursor: onDataPointClick ? "pointer" : undefined,
                  onClick: ((_: any, dotData: any) => { 
                    handleDataPointClick(s.key, s.label, dotData.payload, dotData.index);
                  }) as any,
                }}
              />
            ))}
        </ChartComponent>
      </ChartContainer>
    );
  }

  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      {(title || description) && (
        <CardHeader className="items-center pb-2 flex-none">
          {title && <CardTitle className="text-center">{title}</CardTitle>}
          {description && <CardDescription className="text-center">{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="flex-1 pb-4 min-h-0">{chartContent}</CardContent>
    </Card>
  );
}