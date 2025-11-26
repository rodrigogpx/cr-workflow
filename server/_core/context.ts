import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // Fallback de desenvolvimento: se não houver sessão válida, usar o admin
  if (!user && !ENV.isProduction) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const admin = await db.getUserByEmail(adminEmail);
      if (admin) {
        user = admin as User;
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
