import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bcryptjs", "bullmq", "ioredis", "nodemailer"],
};

export default nextConfig;
