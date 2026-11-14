import { defineConfig, devices } from '@playwright/test';

// Testes de interface: abrem o app gerado (npm run build) num WebKit (motor do Safari)
// com tela de iPhone. Não substituem o teste no iPhone real.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  use: { baseURL: 'http://localhost:4173/habit-tracker/', ...devices['iPhone 15'] },
  projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/habit-tracker/',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
