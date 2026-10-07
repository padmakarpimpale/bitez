import test from "node:test";
import assert from "node:assert/strict";
import {
  emailValidationError,
  passwordValidationError,
} from "../src/authValidation.ts";

test("email validation accepts plus addresses and trims only the email", () => {
  for (const email of [
    "person@example.com",
    "first.last+food@example.com.sg",
    " person@example.com ",
  ]) {
    assert.equal(emailValidationError(email), null);
  }
  for (const email of [
    "",
    "person",
    "person@localhost",
    "person@@example.com",
    "person @example.com",
    "person@example..com",
    "person@.com",
    "a".repeat(243) + "@example.com",
  ]) {
    assert.ok(emailValidationError(email), email);
  }
});

test("new passwords must meet every rule and both length boundaries", () => {
  assert.equal(passwordValidationError("Abcdefghij1!"), null);
  assert.equal(passwordValidationError("Aa1!" + "b".repeat(124)), null);
  for (const password of [
    "Abcdefghi1!",
    "Aa1!" + "b".repeat(125),
    "abcdefghij1!",
    "ABCDEFGHIJ1!",
    "Abcdefghijk!",
    "Abcdefghijk1",
  ]) {
    assert.ok(passwordValidationError(password), password);
  }
});

test("spaces are preserved and do not count as a symbol", () => {
  assert.equal(passwordValidationError(" Abcdefgh1! "), null);
  assert.ok(passwordValidationError(" Abcdefgh123 "));
  assert.ok(passwordValidationError("Abcdefghij1🙂"));
});

test("all supported Supabase punctuation qualifies as a symbol", () => {
  for (const symbol of "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~") {
    assert.equal(
      passwordValidationError(`Abcdefghijk1${symbol}`),
      null,
      symbol,
    );
  }
});
