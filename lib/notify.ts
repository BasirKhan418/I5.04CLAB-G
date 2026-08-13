import { EMAIL_SIGN_OFF, LAB_SHORT } from "@/lib/constants";
import { toChatId } from "@/lib/phone";
import { User } from "@/models/User";

export function visitorCaption(name: string, reason?: string | null) {
  const reasonBit = reason?.trim()
    ? ` Reason: ${reason.trim()}.`
    : "";
  return `Visitor ${name} at ${LAB_SHORT}.${reasonBit} Approve on the lab dashboard to let them in.\n${EMAIL_SIGN_OFF}`;
}

export async function labChatIds() {
  const members = await User.find({
    notifyWhatsApp: true,
    phone: { $ne: null },
  }).select("phone");

  return members
    .map((member) => (member.phone ? toChatId(member.phone) : null))
    .filter((id): id is string => Boolean(id));
}
