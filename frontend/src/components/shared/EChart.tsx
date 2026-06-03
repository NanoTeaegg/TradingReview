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

// 按需注册：当前项目所有图表均为折线图，仅注册折线相关的图表/组件以控制包体。
// ⚠️ 若新增其它系列或组件（柱状 BarChart、缩放 DataZoomComponent、坐标轴指示 AxisPointer 等），
// 必须在此处一并注册，否则对应 option 在运行时不生效（缺组件 echarts 只告警、缺图表类型则报错）。
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
