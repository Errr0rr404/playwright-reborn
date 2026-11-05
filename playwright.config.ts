import { defineConfig, devices } from '@playwright/test';

// Draw with the Mac GPU instead of Playwright's software fallback.
const gpu = process.platform === 'darwin'
  ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] }
  : {};

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
    launchOptions: { ...gpu, executablePath: process.env.REBORN_BROWSER_EXECUTABLE || undefined },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
