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

  it("redacts shorter account/ticket/ID-like numbers, not just full card numbers", () => {
    expect(redactText("Ticket 482910 opened")).toBe("Ticket [REDACTED] opened");
    expect(redactText("Case #113355 closed")).toBe("Case #[REDACTED] closed");
  });

  it("redacts currency-formatted amounts (comma/period separators)", () => {
    expect(redactText("Balance $45,231.00 due")).toBe("Balance $[REDACTED] due");
  });

  it("redacts phone numbers formatted with parentheses and a hyphen", () => {
    // the leading "(" isn't part of the match (the run must start at a
    // digit), same as "$" or "#" staying put in the currency/ticket cases
    // above — only the digits themselves are redacted.
    expect(redactText("Call (555) 123-4567 now")).toBe("Call ([REDACTED] now");
  });

  it("redacts slash-formatted dates (can encode a date of birth)", () => {
    expect(redactText("DOB 12/31/1990 on file")).toBe("DOB [REDACTED] on file");
  });

  it("still leaves genuinely short numbers alone", () => {
    expect(redactText("Row 3 of 12")).toBe("Row 3 of 12");
    expect(redactText("Step 12 of 34")).toBe("Step 12 of 34");
  });
});
