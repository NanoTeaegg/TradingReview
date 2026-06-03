import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: {
      overlay: false,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 启动时即预构建 echarts 相关依赖，避免会话中途首次进入图表页时
  // 触发依赖重新预构建 + 强制刷新，打断懒加载导致「页面加载失败」。
  optimizeDeps: {
    include: [
      'echarts/core',
      'echarts/charts',
      'echarts/components',
      'echarts/renderers',
      'echarts-for-react/esm/core',
    ],
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'zrender-vendor',
              test: /node_modules[\\/]zrender[\\/]/,
              priority: 20,
            },
            {
              name: 'echarts-vendor',
              test: /node_modules[\\/]echarts[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
