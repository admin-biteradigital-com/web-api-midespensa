import { describe, it, expect } from "vitest";
import { runSmokeTests } from "../utils/smoke";

describe("Smoke Tests", () => {
  it("Debería pasar todas las pruebas de humo", async () => {
    const success = await runSmokeTests();
    expect(success).toBe(true);
  });
});
