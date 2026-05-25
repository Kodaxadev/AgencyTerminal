import type { Client } from "discord.js";

type ProcessOutboxFn = (
  client: Client,
  guildId: string,
) => Promise<{ processed: number; errors: number; staleAlerts: number }>;

export interface StartOutboxLoopInput {
  client: Client;
  guildId: string;
  intervalMs?: number;
  processOutboxFn?: ProcessOutboxFn;
  recoverFn?: () => Promise<void>;
}

export interface OutboxLoopControls {
  runOnce(): Promise<"ran" | "skipped" | "stopped">;
  stop(): void;
  stopAndDrain(): Promise<void>;
  isRunning(): boolean;
  isStopped(): boolean;
}

function logLoopError(error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(JSON.stringify({
    level: "error",
    event: "outbox_loop_run_failed",
    error: { name: err.name, message: err.message },
  }));
}

export function startOutboxLoop(input: StartOutboxLoopInput): OutboxLoopControls {
  const intervalMs = input.intervalMs ?? 10_000;
  const processOutboxFn = input.processOutboxFn;
  let stopped = false;
  let running = false;
  let currentRun: Promise<"ran" | "skipped" | "stopped"> | null = null;

  const timer = setInterval(() => {
    void controls.runOnce();
  }, intervalMs);

  const controls: OutboxLoopControls = {
    async runOnce() {
      if (stopped) return "stopped";
      if (running) return "skipped";

      running = true;
      const run = (async (): Promise<"ran"> => {
        try {
          if (input.recoverFn) await input.recoverFn();
          const work = processOutboxFn ?? (await import("./outbox-processor")).processOutbox;
          await work(input.client, input.guildId);
        } catch (error) {
          logLoopError(error);
        } finally {
          running = false;
          currentRun = null;
        }
        return "ran";
      })();
      currentRun = run;

      return run;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
    async stopAndDrain() {
      controls.stop();
      if (currentRun) await currentRun;
    },
    isRunning() {
      return running;
    },
    isStopped() {
      return stopped;
    },
  };

  return controls;
}
