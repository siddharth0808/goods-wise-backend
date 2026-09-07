export function encodeNextToken(
  key: Record<string, unknown>,
): string {
  return Buffer.from(
    JSON.stringify(key),
    "utf8",
  ).toString("base64url");
}

export function decodeNextToken(
  token: string,
): Record<string, unknown> {
  try {
    return JSON.parse(
      Buffer.from(
        token,
        "base64url",
      ).toString("utf8"),
    );
  } catch {
    throw new Error(
      "Invalid pagination token",
    );
  }
}