import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './demo',
  timeout: 15_000,
  forbidOnly: true,
  reporter: [
    ['list'],
    ['./dist/index.js', {
      outputFolder: 'reborn-report',
      open: 'never',
      screenshots: 'steps',
      accent: 'green',
      inline: true,
    }],
  ],
  use: {
    screenshot: 'off',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
