import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";

import { env } from "../config/env.js";

/**
 * Password hashing and JWT issuance/verification for admin and staff logins.
 *
 * Interim, not final — see env.ts. The claim shape (`sub`, `role`,
 * `restaurantId`) is deliberately the same shape a Cognito-issued token would
 * carry, so the auth plugin that reads these claims does not have to change
 * when the signing method does.
 */

const secret = new TextEncoder().encode(env.JWT_SECRET);

// bcrypt's own cost factor. 12 is a common floor for 2026 hardware — high
// enough to be expensive to brute-force, low enough not to make login feel
// slow.
const BCRYPT_COST = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export interface AuthClaims {
  /** The staff account's id. */
  sub: string;
  restaurantId: string;
  role: "admin" | "staff";
  name: string;
}

/** 12-hour session — long enough that a tablet left open on the pass all
 *  shift does not log itself out mid-service (proposal §11). */
const TOKEN_LIFETIME = "12h";

export async function signAuthToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ role: claims.role, restaurantId: claims.restaurantId, name: claims.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(secret);
}

export async function verifyAuthToken(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, secret);

  return {
    sub: payload.sub as string,
    restaurantId: payload.restaurantId as string,
    role: payload.role as "admin" | "staff",
    name: payload.name as string,
  };
}
