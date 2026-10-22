import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.js'], setupFiles: ['./tests/setupEnv.js'], maxWorkers: 1 }
})
