/**
 * DECLARE PACKAGES
 **/
import { Hono } from "hono";
import { logger } from "hono/logger";
import cron from "node-cron";

/**
 * DECLARE FILE
 **/
import carRoutes from "./routes/carsRoute";
import ScrapingDataService from "./services/scrapeDataService";

/**
 * DECLARE SERVICE
 **/
const app = new Hono();
const scraping = new ScrapingDataService();

/**
 * ACTIVATE ROUTE
 **/
app.use(logger());
app.get("/test", async (c) => {
  return c.text("Hello world!");
});
app.route("/", carRoutes);

/**
 * RUNNING SCRRAPING METHOD EVERY 1 MONTH AT 2 O'CLOCK
 **/
cron.schedule("0 2 1 * *", async () => {
  console.log("[CRON] Scraping dimulai:", new Date().toISOString());
  try {
    const result = await scraping.start();
    console.log("[CRON] Scraping selesai. Total mobil:", result);
    // Simpan ke file/database di sini jika perlu
  } catch (err) {
    console.error("[CRON] Gagal scraping:", err);
  }
});

// Start time
const startTime = process.hrtime.bigint();

// Bisa juga langsung dijalankan sekali saat program start
(async () => {
  console.log("[STARTUP] Menjalankan scraping pertama kali...");

  try {
    // Trigger scraping method
    const result = await scraping.start();

    // End time
    const endTime = process.hrtime.bigint();
    const durationInSeconds = Number(endTime - startTime) / 1e9;

    // Memory usage
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();

    /**
     * DISPLAY SCRAPING RESULTS => DURATION && MEMORY && CPU
     **/
    console.log("✅ Scraping finished! ======================\n");
    console.log(result.message);
    console.log("==========================================\n");

    console.log(`⏱ Duration: ${durationInSeconds.toFixed(2)} seconds`);
    console.log("==========================================\n\n");

    console.log("📦 Memory Usage:");
    console.log(`  RSS: ${(memory.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(
      `  Heap Used: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(
      `  Heap Total: ${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`
    );
    console.log("==========================================\n\n");

    console.log("🧠 CPU Usage:");
    console.log(`  User: ${cpu.user / 1000} ms`);
    console.log(`  System: ${cpu.system / 1000} ms`);
    console.log("==========================================\n\n");

    // DISPLAY DATA CARS
    console.log("🚗 Data Cars");
    console.log("BRANDS DATA: ===============");
    console.log(result.brands);

    // DISPLAY DATA LENGTH EVERY SECTION
    console.log("🧮 Amout Data: ===============");
    console.log(`  Brands: ${result.amountData.brands}`);
    console.log(`  Models: ${result.amountData.models}`);
    console.log(`  Generations: ${result.amountData.gen}`);
    console.log(`  Cars: ${result.amountData.cars}`);
    console.log("==========================================\n\n");
  } catch (err) {
    console.error("[STARTUP] Error:", err);
  }
})();

// RUNNING BUN SERVER
Bun.serve({
  port: 8080,
  fetch: app.fetch,
  idleTimeout: 60,
});
