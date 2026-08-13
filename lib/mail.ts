import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";
import { LAB_NAME } from "@/lib/constants";
import {
  otpEmailHtml,
  phoneOtpHtml,
  welcomePinHtml,
} from "@/emails/templates";

const globalForMail = globalThis as unknown as {
  mailer?: nodemailer.Transporter;
};

function getTransport() {
  if (globalForMail.mailer) {
    return globalForMail.mailer;
  }
  const env = getEnv();
  const mailer = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  if (process.env.NODE_ENV !== "production") {
    globalForMail.mailer = mailer;
  }
  return mailer;
}

async function sendMail(to: string, subject: string, html: string) {
  const env = getEnv();
  await getTransport().sendMail({
    from: env.mailFrom,
    to,
    subject,
    html,
  });
}

export async function sendOtpEmail(to: string, otp: string, purpose: string) {
  await sendMail(to, `${LAB_NAME} login code`, otpEmailHtml(otp, purpose));
}

export async function sendWelcomePin(to: string, name: string, pin: string) {
  await sendMail(to, `Your ${LAB_NAME} PIN`, welcomePinHtml(name, pin));
}

export async function sendPhoneChangeEmail(to: string, otp: string) {
  await sendMail(to, `${LAB_NAME} number change code`, phoneOtpHtml(otp));
}
