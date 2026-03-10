import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";

dotenv.config();

const chromaContainer = process.env.CHROMA_CONTAINER || "twitter-trend-chroma";
const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
const restartDelayMs = Number(process.env.SUPERVISOR_RESTART_DELAY_MS || 2000);
const chromaCheckIntervalMs = Number(process.env.CHROMA_CHECK_INTERVAL_MS || 5000);
const startupWaitMs = Number(process.env.SUPERVISOR_STARTUP_WAIT_MS || 1500);

interface ManagedProcess {
  name: string;
  command: string;
  args: string[];
  child: ChildProcess | null;
  stopping: boolean;
}

const services: ManagedProcess[] = [
  {
    name: "next",
    command: "npm",
    args: ["run", "dev"],
    child: null,
    stopping: false
  },
  {
    name: "scheduler",
    command: "npm",
    args: ["run", "scheduler"],
    child: null,
    stopping: false
  }
];

let shuttingDown = false;
let chromaTimer: NodeJS.Timeout | null = null;

function log(service: string, message: string): void {
  console.log(`[${new Date().toISOString()}] [${service}] ${message}`);
}

function pipeOutput(service: string, stream: NodeJS.ReadableStream | null, target: NodeJS.WriteStream): void {
  if (!stream) {
    return;
  }

  stream.on("data", (chunk: Buffer | string) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.length === 0) {
        continue;
      }
      target.write(`[${service}] ${line}\n`);
    }
  });
}

function startManagedProcess(service: ManagedProcess): void {
  if (shuttingDown) {
    return;
  }

  log(service.name, `starting: ${service.command} ${service.args.join(" ")}`);
  const child = spawn(service.command, service.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CHROMA_URL: chromaUrl
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  service.child = child;
  service.stopping = false;

  pipeOutput(service.name, child.stdout, process.stdout);
  pipeOutput(service.name, child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    service.child = null;
    const expected = shuttingDown || service.stopping;
    log(service.name, `exited code=${code ?? "null"} signal=${signal ?? "null"}`);

    if (!expected) {
      void restartManagedProcess(service);
    }
  });

  child.on("error", (error) => {
    log(service.name, `spawn error: ${error.message}`);
  });
}

async function restartManagedProcess(service: ManagedProcess): Promise<void> {
  if (shuttingDown) {
    return;
  }

  log(service.name, `restarting in ${restartDelayMs}ms`);
  await delay(restartDelayMs);
  if (!service.child && !shuttingDown) {
    startManagedProcess(service);
  }
}

function runCommand(command: string, args: string[], ignoreFailure = false): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (ignoreFailure) {
        resolve({ code: 1, stdout, stderr: `${stderr}${error.message}` });
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (!ignoreFailure && exitCode !== 0) {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${exitCode}: ${stderr || stdout}`));
        return;
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

async function heartbeat(): Promise<boolean> {
  const url = new URL(chromaUrl);
  const base = `${url.protocol}//${url.host}`;

  for (const endpoint of ["/api/v2/heartbeat", "/api/v1/heartbeat"]) {
    try {
      const response = await fetch(`${base}${endpoint}`);
      if (response.ok) {
        return true;
      }
    } catch {
      // ignore and try next endpoint
    }
  }

  return false;
}

async function ensureChromaRunning(forceRestart = false): Promise<void> {
  const healthy = await heartbeat();
  if (healthy && !forceRestart) {
    return;
  }

  log("chroma", forceRestart ? "forcing restart" : "heartbeat failed; restarting container");
  await runCommand("docker", ["rm", "-f", chromaContainer], true);
  await runCommand("docker", ["run", "-d", "--name", chromaContainer, "-p", "8000:8000", "chromadb/chroma:latest"]);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await heartbeat()) {
      log("chroma", "healthy");
      return;
    }
    await delay(1000);
  }

  throw new Error("Chroma failed to become healthy after restart");
}

async function startChromaMonitor(): Promise<void> {
  await ensureChromaRunning();
  chromaTimer = setInterval(() => {
    void ensureChromaRunning().catch((error) => {
      log("chroma", `monitor error: ${error.message}`);
    });
  }, chromaCheckIntervalMs);
}

async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log("supervisor", "shutting down");

  if (chromaTimer) {
    clearInterval(chromaTimer);
    chromaTimer = null;
  }

  for (const service of services) {
    if (service.child) {
      service.stopping = true;
      service.child.kill("SIGTERM");
    }
  }

  await delay(1500);

  for (const service of services) {
    if (service.child && !service.child.killed) {
      service.child.kill("SIGKILL");
    }
  }

  process.exit(exitCode);
}

async function main(): Promise<void> {
  log("supervisor", `starting stack with CHROMA_URL=${chromaUrl}`);
  await startChromaMonitor();
  for (const service of services) {
    startManagedProcess(service);
    await delay(startupWaitMs);
  }
  log("supervisor", "stack is running; press Ctrl+C to stop");
}

process.on("SIGINT", () => {
  void shutdown(0);
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

process.on("uncaughtException", (error) => {
  log("supervisor", `uncaught exception: ${error.message}`);
  void shutdown(1);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  log("supervisor", `unhandled rejection: ${message}`);
  void shutdown(1);
});

void main().catch((error) => {
  log("supervisor", `startup failed: ${error.message}`);
  void shutdown(1);
});
