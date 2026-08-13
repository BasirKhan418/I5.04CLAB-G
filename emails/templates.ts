import { LAB_NAME, EMAIL_SIGN_OFF_HTML } from "@/lib/constants";

const cream = "#FFF9F2";
const red = "#FF4D40";
const ink = "#111111";
const yellow = "#FFF4B8";

function wrap(inner: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:${cream};font-family:Arial,Helvetica,sans-serif;color:${ink};">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:2px solid ${ink};border-radius:28px;box-shadow:6px 6px 0 ${ink};overflow:hidden;">
      <tr>
        <td style="padding:28px 28px 12px;">
          <div style="width:18px;height:18px;border:2px solid ${ink};border-radius:999px;display:inline-block;background:${red};margin-right:6px;"></div>
          <div style="width:18px;height:18px;border:2px solid ${ink};border-radius:999px;display:inline-block;background:${yellow};"></div>
          <p style="margin:12px 0 0;font-weight:700;font-size:14px;">${LAB_NAME}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 32px;">${inner}</td>
      </tr>
    </table>
  </body>
</html>`;
}

export function otpEmailHtml(otp: string, purpose: string) {
  return wrap(`
    <h1 style="font-size:28px;margin:0 0 12px;line-height:1.2;">Your one-time code</h1>
    <p style="margin:0 0 18px;color:#444;">Use this code to ${purpose}. It expires in 5 minutes.</p>
    <div style="display:inline-block;background:${yellow};border:2px solid ${ink};border-radius:16px;padding:14px 22px;font-size:32px;letter-spacing:8px;font-weight:800;">${otp}</div>
    <p style="margin:22px 0 0;font-size:13px;color:#555;">${EMAIL_SIGN_OFF_HTML}</p>
  `);
}

export function welcomePinHtml(name: string, pin: string) {
  return wrap(`
    <h1 style="font-size:28px;margin:0 0 12px;line-height:1.2;">You're on the lab roster</h1>
    <p style="margin:0 0 12px;color:#444;">Hi ${name}, an admin added you to ${LAB_NAME}. Sign in with this email and your default PIN, then change it.</p>
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;">Default PIN</p>
    <div style="display:inline-block;background:${red};color:#fff;border:2px solid ${ink};border-radius:16px;padding:14px 22px;font-size:32px;letter-spacing:8px;font-weight:800;">${pin}</div>
    <p style="margin:22px 0 0;font-size:13px;color:#555;">No public signup — keep this PIN to yourself. ${EMAIL_SIGN_OFF_HTML}</p>
  `);
}

export function phoneOtpHtml(otp: string) {
  return wrap(`
    <h1 style="font-size:28px;margin:0 0 12px;">Confirm your new number</h1>
    <p style="margin:0 0 18px;color:#444;">An admin is changing a WhatsApp number. Enter this code to confirm.</p>
    <div style="display:inline-block;background:${yellow};border:2px solid ${ink};border-radius:16px;padding:14px 22px;font-size:32px;letter-spacing:8px;font-weight:800;">${otp}</div>
    <p style="margin:22px 0 0;font-size:13px;color:#555;">${EMAIL_SIGN_OFF_HTML}</p>
  `);
}
