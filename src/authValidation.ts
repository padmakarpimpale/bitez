// Keep this policy aligned with the free Supabase Auth password settings.
const symbols = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export const passwordRules = [
  {
    label: "12–128 characters",
    test: (value: string) => value.length >= 12 && value.length <= 128,
  },
  {
    label: "One uppercase letter (A–Z)",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    label: "One lowercase letter (a–z)",
    test: (value: string) => /[a-z]/.test(value),
  },
  { label: "One number (0–9)", test: (value: string) => /[0-9]/.test(value) },
  {
    label: "One symbol, such as ! @ #",
    test: (value: string) => [...value].some((char) => symbols.includes(char)),
  },
];

export function passwordValidationError(value: string): string | null {
  const missing = passwordRules.filter((rule) => !rule.test(value));
  return missing.length
    ? `Password needs: ${missing.map((rule) => rule.label.toLowerCase()).join(", ")}.`
    : null;
}

export function emailValidationError(value: string): string | null {
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) {
    return "Enter a valid email address, such as name@example.com.";
  }
  return null;
}
