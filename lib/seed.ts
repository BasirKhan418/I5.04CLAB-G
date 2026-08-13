import { getEnv } from "@/lib/env";
import { sendWelcomePin } from "@/lib/mail";
import { generatePin, hashPin } from "@/lib/pin";
import { User } from "@/models/User";

let seeded = false;

export async function ensureSuperadmin() {
  if (seeded) {
    return;
  }

  const email = getEnv().superadminEmail;
  if (!email) {
    seeded = true;
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "superadmin") {
      existing.role = "superadmin";
      await existing.save();
    }
    seeded = true;
    return;
  }

  const count = await User.countDocuments();
  if (count > 0) {
    seeded = true;
    return;
  }

  const pin = generatePin();
  await User.create({
    name: "Lab Superadmin",
    email,
    role: "superadmin",
    pinHash: await hashPin(pin),
    mustChangePin: true,
    notifyWhatsApp: true,
  });
  try {
    await sendWelcomePin(email, "Lab Superadmin", pin);
    console.info(`Seeded superadmin at ${email}; default PIN emailed.`);
  } catch (error) {
    console.error("Superadmin created but welcome email failed", error);
  }
  seeded = true;
}
