import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";
import { getEnv } from "@/lib/env";
import { S3_PREFIX } from "@/lib/constants";

const globalForS3 = globalThis as unknown as { s3?: S3Client };

function getS3() {
  if (globalForS3.s3) {
    return globalForS3.s3;
  }
  const env = getEnv();
  const s3 = new S3Client({
    region: env.awsRegion,
    credentials: {
      accessKeyId: env.awsAccessKeyId,
      secretAccessKey: env.awsSecretAccessKey,
    },
  });
  if (process.env.NODE_ENV !== "production") {
    globalForS3.s3 = s3;
  }
  return s3;
}

export async function uploadBuffer(opts: {
  body: Buffer;
  contentType: string;
  folder: "face" | "voice";
  ext: string;
}) {
  const env = getEnv();
  const key = `${S3_PREFIX}/${opts.folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${opts.ext}`;
  await getS3().send(
    new PutObjectCommand({
      Bucket: env.awsBucketName,
      Key: key,
      Body: opts.body,
      ContentType: opts.contentType,
      ContentDisposition: "inline",
    })
  );
  return key;
}

export async function getObject(key: string) {
  const env = getEnv();
  const res = await getS3().send(
    new GetObjectCommand({
      Bucket: env.awsBucketName,
      Key: key,
    })
  );
  if (!res.Body) {
    throw new Error("Empty S3 object");
  }
  return {
    stream: res.Body.transformToWebStream(),
    contentType: res.ContentType ?? "application/octet-stream",
    contentLength: res.ContentLength,
  };
}

export async function presignGet(key: string, expiresIn = 60 * 60 * 6) {
  const env = getEnv();
  return getSignedUrl(
    getS3(),
    new GetObjectCommand({
      Bucket: env.awsBucketName,
      Key: key,
    }),
    { expiresIn }
  );
}
