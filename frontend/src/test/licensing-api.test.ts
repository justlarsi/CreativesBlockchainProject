import { afterEach, describe, expect, it, vi } from "vitest";
import {
  certificateDownloadUrl,
  prepareLicensePurchase,
  submitLicenseReceipt,
} from "@/api/licensing";

describe("licensing api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prepares a purchase payload", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          purchase_id: 1,
          status: "PENDING_CONFIRMATION",
          to: "0xabc",
          data: "0x123",
          value: "0x10",
          chain_id: 80002,
          max_retries: 8,
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const result = await prepareLicensePurchase("token", {
      work_id: 99,
      template: "personal",
      rights_scope: "non_commercial",
    });

    expect(result.purchase_id).toBe(1);
    expect(result.to).toBe("0xabc");
    expect(String(spy.mock.calls[0]?.[0])).toContain("/api/v1/licenses/prepare/");
  });

  it("submits tx receipt", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "PENDING_CONFIRMATION",
          purchase_id: 1,
          tx_hash: "0x" + "a".repeat(64),
          explorer_url: "https://amoy.polygonscan.com/tx/0x" + "a".repeat(64),
          message: "Receipt verification queued.",
          max_retries: 8,
        }),
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const txHash = "0x" + "a".repeat(64);
    const result = await submitLicenseReceipt("token", {
      purchase_id: 1,
      idempotency_key: "license-receipt-test-key",
      tx_hash: txHash,
    });
    expect(result.tx_hash).toBe(txHash);
    expect(String(spy.mock.calls[0]?.[0])).toContain("/api/v1/licenses/receipt/");
  });

  it("builds certificate endpoint url", () => {
    expect(certificateDownloadUrl(55)).toContain("/api/v1/licenses/55/certificate/");
  });
});


