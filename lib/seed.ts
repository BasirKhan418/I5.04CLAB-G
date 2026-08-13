import { getEnv } from "@/lib/env";
import { sendWelcomePin } from "@/lib/mail";
import { generatePin, hashPin } from "@/lib/pin";
import { User } from "@/models/User";

let seeded = false;

async function enforceSingleSuperadmin() {
  const email = getEnv().superadminEmail;
  if (email) {
    const primary = await User.findOne({ email });
    if (primary && primary.role !== "superadmin") {
      primary.role = "superadmin";
      await primary.save();
    }
    if (primary) {
      await User.updateMany(
        { _id: { $ne: primary._id }, role: "superadmin" },
        { $set: { role: "admin" } }
      );
      return;
    }
  }

  const extras = await User.find({ role: "superadmin" }).sort({ createdAt: 1 });
  if (extras.length <= 1) {
    return;
  }
  const keep = extras[0];
  await User.updateMany(
    { _id: { $ne: keep._id }, role: "superadmin" },
    { $set: { role: "admin" } }
  );
}

export async function ensureSuperadmin() {
  const email = getEnv().superadminEmail;

  if (!seeded && email) {
    const existing = await User.findOne({ email });
    if (!existing) {
      const count = await User.countDocuments();
      if (count === 0) {
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
      }
    }
    seeded = true;
  }

  await enforceSingleSuperadmin();
}
