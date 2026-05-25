import type { Client } from "discord.js";
import type { OutboxLoopControls } from "./outbox-loop";

type SignalName = "SIGTERM" | "SIGINT";

interface ProcessLike {
  on(event: SignalName, handler: () => void): unknown;
  off?(event: SignalName, handler: () => void): unknown;
  exitCode?: number;
}

export interface InstallRuntimeLifecycleInput {
  loop?: Pick<OutboxLoopControls, "stopAndDrain">;
  client: Pick<Client, "destroy">;
  closeDbPool: () => Promise<void>;
  processLike?: ProcessLike;
  shutdownTimeoutMs?: number;
}

export interface RuntimeLifecycleControls {
  attachLoop(loop: Pick<OutboxLoopControls, "stopAndDrain">): void;
  isShuttingDown(): boolean;
  shutdown(signal?: SignalName): Promise<void>;
  uninstall(): void;
}

async function withTimeout(work: Promise<void>, timeoutMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work,
      new Promise<void>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("shutdown drain timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function logShutdownStepFailure(step: string, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(JSON.stringify({
    level: "error",
    event: "runtime_shutdown_step_failed",
    step,
    error: { name: err.name, message: err.message },
  }));
}

export function installRuntimeLifecycle(
  input: InstallRuntimeLifecycleInput,
): RuntimeLifecycleControls {
  const processLike = input.processLike ?? process;
  const shutdownTimeoutMs = input.shutdownTimeoutMs ?? 15_000;
  let loop = input.loop;
  let shutdownStarted = false;
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = async (_signal?: SignalName) => {
    if (shutdownPromise) return shutdownPromise;
    shutdownStarted = true;
    let failed = false;

    shutdownPromise = (async () => {
      if (loop) {
        try {
          await withTimeout(loop.stopAndDrain(), shutdownTimeoutMs);
        } catch (error) {
          failed = true;
          logShutdownStepFailure("outbox_loop", error);
        }
      }

      try {
        await input.client.destroy();
      } catch (error) {
        failed = true;
        logShutdownStepFailure("discord_client", error);
      }

      try {
        await input.closeDbPool();
      } catch (error) {
        failed = true;
        logShutdownStepFailure("db_pool", error);
      }

      processLike.exitCode = failed ? 1 : 0;
    })();

    return shutdownPromise;
  };

  const onSignal = (signal: SignalName) => {
    if (shutdownStarted) return;
    void shutdown(signal);
  };
  const onSigterm = () => onSignal("SIGTERM");
  const onSigint = () => onSignal("SIGINT");

  processLike.on("SIGTERM", onSigterm);
  processLike.on("SIGINT", onSigint);

  return {
    attachLoop(nextLoop) {
      loop = nextLoop;
    },
    isShuttingDown() {
      return shutdownStarted;
    },
    shutdown,
    uninstall() {
      processLike.off?.("SIGTERM", onSigterm);
      processLike.off?.("SIGINT", onSigint);
    },
  };
}
