import { describe, expect, it } from "vitest";
import { directKey, FRIEND_CODE_PATTERN, isVerifiedRole, randomFriendCode, sendMessageSchema, startDirectSchema } from "./messaging";

describe("friend codes", () => {
  it("generates valid 6-character codes", () => {
    for (let i = 0; i < 200; i++) expect(randomFriendCode()).toMatch(FRIEND_CODE_PATTERN);
  });

  it("normalises what people type", () => {
    expect(startDirectSchema.parse({ friendCode: " k7m-2qx " }).friendCode).toBe("K7M2QX");
    expect(startDirectSchema.safeParse({ friendCode: "O0I1L2" }).success).toBe(false);
    expect(startDirectSchema.safeParse({ friendCode: "ABC" }).success).toBe(false);
  });
});

describe("messages", () => {
  it("trims and bounds message bodies", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(sendMessageSchema.parse({ clientMessageId: id, body: "  salut  " }).body).toBe("salut");
    expect(sendMessageSchema.safeParse({ clientMessageId: id, body: "   " }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ clientMessageId: id, body: "x".repeat(2001) }).success).toBe(false);
  });

  it("builds the same direct key whoever starts the chat", () => {
    expect(directKey("b", "a")).toBe(directKey("a", "b"));
  });

  it("marks staff as verified", () => {
    expect(isVerifiedRole("admin")).toBe(true);
    expect(isVerifiedRole("teacher")).toBe(true);
    expect(isVerifiedRole("student")).toBe(false);
  });
});
