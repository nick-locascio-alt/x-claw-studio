import "@/src/lib/env";
import { evaluateSchedule, readSchedulerConfig } from "@/src/server/run-control";

const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS || 60_000);

console.log(`scheduler daemon started; polling every ${intervalMs}ms`);
console.log(`current config: ${JSON.stringify(readSchedulerConfig())}`);

async function tick(): Promise<void> {
  const result = evaluateSchedule();
  if (result.triggered) {
    console.log(
      `[${new Date().toISOString()}] triggered scheduled run ${result.entry?.runControlId}`
    );
  }
}

async function main(): Promise<void> {
  await tick();
  setInterval(() => {
    tick().catch((error: Error) => {
      console.error(`[${new Date().toISOString()}] scheduler error: ${error.message}`);
    });
  }, intervalMs);
}

void main().catch((error: Error) => {
  console.error(`[${new Date().toISOString()}] scheduler startup error: ${error.message}`);
  process.exit(1);
});
