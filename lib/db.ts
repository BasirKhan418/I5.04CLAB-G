import mongoose from "mongoose";
import { getEnv } from "@/lib/env";
import { ensureSuperadmin } from "@/lib/seed";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as {
  mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!globalForMongoose.mongooseCache) {
  globalForMongoose.mongooseCache = cache;
}

export async function connectDB() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(getEnv().mongoUri).then((m) => m);
  }

  cache.conn = await cache.promise;
  await ensureSuperadmin();
  return cache.conn;
}
