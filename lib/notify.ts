import { DEFAULT_VISITOR_NAME, EMAIL_SIGN_OFF, LAB_SHORT } from "@/lib/constants";
import { toChatId } from "@/lib/phone";
import { User } from "@/models/User";

export type NotifyRecipient = {
  chatId: string;
  name: string;
};

export function visitorName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed || DEFAULT_VISITOR_NAME;
}

export function visitorTemplateVars(
  memberName: string,
  uname: string,
  reason?: string | null
) {
  return {
    name: memberName.trim() || "there",
    uname: visitorName(uname),
    reason: reason?.trim() || "-",
  };
}

export function visitorAlertText(
  memberName: string,
  uname: string,
  reason?: string | null
) {
  const who = visitorName(uname);
  const hi = memberName.trim() || "there";
  const reasonLine = reason?.trim()
    ? `\n📝 *Reason:* ${reason.trim()}\n`
    : "\n";
  return `🔔 *Lab Door Access Request*

Hi ${hi},

🚪 *${who} is waiting outside the lab.*
${reasonLine}
If you are currently inside the lab, please *unlock the door by tapping your access card*.

Your quick assistance would be greatly appreciated. 🙏

Thank you!

Regards,
*I5.04C Lab Developer Team*`;
}

export function phoneVerifyText(otp: string) {
  return `🔐 *${LAB_SHORT} number check*

Your code is *${otp}*.

Confirm this WhatsApp so you get visitor alerts from the lab.

${EMAIL_SIGN_OFF}`;
}

export function visitorImageCaption(reason?: string | null) {
  const text = reason?.trim();
  return text || undefined;
}

export async function labRecipients(): Promise<NotifyRecipient[]> {
  const members = await User.find({
    notifyWhatsApp: true,
    phone: { $ne: null },
  }).select("phone name");

  const seen = new Set<string>();
  const recipients: NotifyRecipient[] = [];
  for (const member of members) {
    if (!member.phone) continue;
    const chatId = toChatId(member.phone);
    if (seen.has(chatId)) continue;
    seen.add(chatId);
    recipients.push({
      chatId,
      name: member.name?.trim() || "there",
    });
  }
  return recipients;
}
