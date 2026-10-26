import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8765",
    headless: true,
    launchOptions: { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] },
    trace: "retain-on-failure",
    video: "on",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 8765 --bind 127.0.0.1 --directory ../..",
    url: "http://127.0.0.1:8765",
    reuseExistingServer: false,
  },
});
