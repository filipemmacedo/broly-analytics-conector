import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { appEnv } from "@/lib/env";
import type { EncryptedTokenSet, TokenSet } from "@/lib/types";

function getKey() {
  return createHash("sha256").update(appEnv.sessionSecret).digest();
}

export function encryptTokenSet(tokenSet: TokenSet): EncryptedTokenSet {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(tokenSet), "utf8"),
    cipher.final()
  ]);

  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    content: encrypted.toString("base64")
  };
}

export function decryptTokenSet(tokenSet?: EncryptedTokenSet): TokenSet | null {
  if (!tokenSet) {
    return null;
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(tokenSet.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tokenSet.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(tokenSet.content, "base64")),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8")) as TokenSet;
}
