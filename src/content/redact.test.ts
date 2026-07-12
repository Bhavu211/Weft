import { describe, expect, it } from "vitest";
import { redactText } from "./redact";

describe("redactText", () => {
  it("redacts email addresses", () => {
    expect(redactText("Contact: jane.doe@example.com")).toBe("Contact: [REDACTED]");
  });

  it("redacts PAN numbers", () => {
    expect(redactText("PAN ABCDE1234F on file")).toBe("PAN [REDACTED] on file");
  });

  it("redacts GST numbers", () => {
    expect(redactText("GSTIN 22AAAAA0000A1Z5")).toBe("GSTIN [REDACTED]");
  });

  it("redacts long account/card-like digit runs", () => {
    expect(redactText("Card 4111 1111 1111 1111")).toBe("Card [REDACTED]");
    expect(redactText("Account 123456789")).toBe("Account [REDACTED]");
  });

  it("redacts phone-like 10-digit numbers", () => {
    expect(redactText("Call 9876543210 now")).toBe("Call [REDACTED] now");
  });

  it("leaves ordinary short text untouched", () => {
    expect(redactText("Submit Order")).toBe("Submit Order");
    expect(redactText("Step 12 of 34")).toBe("Step 12 of 34");
  });

  it("redacts multiple PII instances in one string", () => {
    expect(redactText("email a@b.com or call 9876543210")).toBe(
      "email [REDACTED] or call [REDACTED]"
    );
  });
});
