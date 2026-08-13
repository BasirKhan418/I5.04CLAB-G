function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnv() {
  return {
    mongoUri: required("MONGO_URI"),
    redisUrl: required("REDIS_URL"),
    jwtSecret: required("JWT_SECRET"),
    awsRegion: required("AWS_REGION"),
    awsAccessKeyId: required("AWS_ACCESS_KEY_ID"),
    awsSecretAccessKey: required("AWS_SECRET_ACCESS_KEY"),
    awsBucketName: required("AWS_BUCKET_NAME"),
    openwaSessionId: required("SESSION_ID_OPENWA"),
    openwaTemplateId: process.env.TEMPLATE_ID_OPENWA ?? "",
    openwaApiKey: required("OPENWA_API_KEY"),
    openwaApiUrl: required("OPENWA_API_URL").replace(/\/$/, ""),
    smtpHost: required("SMTP_HOST"),
    smtpPort: Number(process.env.SMTP_PORT ?? "587"),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: required("SMTP_USER"),
    smtpPass: required("SMTP_PASS"),
    mailFrom: required("MAIL_FROM"),
    superadminEmail: process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() ?? "",
    doorDeviceToken: process.env.DOOR_DEVICE_TOKEN?.trim() ?? "",
    doorWsPort: Number(process.env.DOOR_WS_PORT ?? "8787"),
    doorOpenMs: Number(process.env.DOOR_OPEN_MS ?? "2500"),
  };
}
