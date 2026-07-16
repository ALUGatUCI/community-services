// Validation rules for VPS requests, shared between the client form (for UX)
// and the server route handler (which enforces them authoritatively).

// Matches a uci.edu address, including subdomains such as @alumni.uci.edu.
export const UCI_EMAIL_PATTERN = /^[^\s@]+@([a-z0-9-]+\.)*uci\.edu$/i;

export const MAX_REASON_LENGTH = 2000;

export type RequestInput = {
  email: string;
  reason: string;
};

// Returns an error message if the input is invalid, or null if it is valid.
export function validateRequest(input: Partial<RequestInput>): string | null {
  const email = (input.email ?? "").trim();
  const reason = (input.reason ?? "").trim();

  if (!email) {
    return "Please enter your UCI email address.";
  }
  if (!UCI_EMAIL_PATTERN.test(email)) {
    return "Please enter a valid uci.edu email address.";
  }
  if (!reason) {
    return "Please explain your reasons for requesting a VPS.";
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return `Please keep your reason under ${MAX_REASON_LENGTH} characters.`;
  }

  return null;
}
