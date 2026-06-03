import ReactEChartsCoreImport from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsReactProps } from 'echarts-for-react'

echarts.use([
  LineChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

// 某些打包器（vite 8 / rolldown）对 CJS interop 会把默认导出包成命名空间对象
// （{ default: Component }），导致直接渲染时报 "Element type is invalid ... got: object"。
// 这里做一次防御性解包，无论拿到的是组件还是命名空间都能取到真正的组件。
const ReactEChartsCore =
  (ReactEChartsCoreImport as unknown as { default?: typeof ReactEChartsCoreImport }).default ??
  ReactEChartsCoreImport

type EChartProps = Omit<EChartsReactProps, 'echarts'>

export default function EChart(props: EChartProps) {
  return <ReactEChartsCore echarts={echarts} {...props} />
}
