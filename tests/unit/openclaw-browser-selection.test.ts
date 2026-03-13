import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock
}));

describe("openclaw x-tab selection", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("returns the requested X tab when it is controllable", async () => {
    execFileMock.mockImplementation((file, args, options, callback) => {
      const done = callback as (error: Error | null, result?: { stdout: string; stderr: string }) => void;
      if (Array.isArray(args) && args.includes("tabs")) {
        done(null, {
          stdout: JSON.stringify({
            tabs: [
              { targetId: "1", url: "https://example.com" },
              { targetId: "2", url: "https://x.com/home", title: "Home / X" }
            ]
          }),
          stderr: ""
        });
        return {} as never;
      }

      if (Array.isArray(args) && args.includes("evaluate")) {
        done(null, {
          stdout: JSON.stringify({ href: "https://x.com/home", title: "Home / X" }),
          stderr: ""
        });
        return {} as never;
      }

      done(new Error(`Unexpected args: ${String(args)}`));
      return {} as never;
    });

    const mod = await import("@/src/server/openclaw-browser");
    const chosen = await mod.chooseAttachedXTab(1);

    expect(chosen.targetId).toBe("2");
  });

  it("falls back to another X tab when the requested one is listed but broken", async () => {
    execFileMock.mockImplementation((file, args, options, callback) => {
      const done = callback as (error: Error | null, result?: { stdout: string; stderr: string }) => void;
      if (Array.isArray(args) && args.includes("tabs")) {
        done(null, {
          stdout: JSON.stringify({
            tabs: [
              { targetId: "broken", url: "https://x.com/netcapgirl", title: "Profile / X" },
              { targetId: "healthy", url: "https://x.com/home", title: "Home / X" }
            ]
          }),
          stderr: ""
        });
        return {} as never;
      }

      if (Array.isArray(args) && args.includes("evaluate")) {
        const targetId = String(args[args.indexOf("--target-id") + 1] ?? "");
        if (targetId === "broken") {
          done(new Error("tab not found"));
          return {} as never;
        }

        done(null, {
          stdout: JSON.stringify({ href: "https://x.com/home", title: "Home / X" }),
          stderr: ""
        });
        return {} as never;
      }

      done(new Error(`Unexpected args: ${String(args)}`));
      return {} as never;
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const mod = await import("@/src/server/openclaw-browser");
    const chosen = await mod.chooseAttachedXTab(0);

    expect(chosen.targetId).toBe("healthy");
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});
