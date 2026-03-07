// hourbit\app\lib\mailer.ts

import nodemailer from "nodemailer";

export async function sendOTPEmail(email: string, otp: string) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Hour Bit" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your Hour Bit account",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify Your Hour Bit Account</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d14;font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d14;padding:40px 16px;">
    <tr>
      <td align="center">

        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#12121f;border-radius:16px;border:1px solid #2a2a3e;overflow:hidden;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#7c6ef3,#22d3a0);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:36px 40px 24px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#7c6ef3,#22d3a0);border-radius:12px;padding:10px 18px;">
                <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">&#9201; Hour Bit</span>
              </div>
              <p style="margin:20px 0 0;font-size:13px;color:#9898b0;letter-spacing:1.5px;text-transform:uppercase;">Account Verification</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background-color:#2a2a3e;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 12px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#e8e8f0;line-height:1.3;">
                Verify Your Account
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#9898b0;line-height:1.6;">
                Thanks for signing up! Use the one-time code below to verify your Hour Bit account and get started.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <div style="display:inline-block;background-color:#1a1a2e;border:1.5px solid #7c6ef3;border-radius:14px;padding:20px 48px;">
                      <p style="margin:0 0 6px;font-size:11px;color:#7c6ef3;letter-spacing:2px;text-transform:uppercase;font-weight:600;">Your OTP Code</p>
                      <p style="margin:0;font-size:42px;font-weight:800;color:#ffffff;letter-spacing:10px;font-family:'Courier New',monospace;">
                        ${otp}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <span style="display:inline-block;background-color:#1e2d28;border:1px solid #22d3a0;border-radius:20px;padding:7px 18px;font-size:13px;color:#22d3a0;font-weight:600;">
                      &#9203; &nbsp;Expires in 10 minutes
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#16162a;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <tr>
                  <td style="padding:0 0 10px;">
                    <p style="margin:0;font-size:12px;color:#7c6ef3;letter-spacing:1px;text-transform:uppercase;font-weight:700;">How to verify</p>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:14px;color:#c8c8d8;">
                      <span style="color:#7c6ef3;font-weight:700;">1.</span>&nbsp; Copy the 6-digit code above.
                    </p>
                    <p style="margin:0 0 8px;font-size:14px;color:#c8c8d8;">
                      <span style="color:#7c6ef3;font-weight:700;">2.</span>&nbsp; Paste it into the verification box on Hour Bit.
                    </p>
                    <p style="margin:0;font-size:14px;color:#c8c8d8;">
                      <span style="color:#7c6ef3;font-weight:700;">3.</span>&nbsp; Start tracking your work hours — for free!
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e1a10;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:8px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:13px;color:#d4a84b;line-height:1.5;">
                      &#128274; &nbsp;<strong>Security Notice:</strong> Hour Bit will never ask for your password by email. If you did not create this account, please ignore this message.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:12px 40px 0;">
              <div style="height:1px;background-color:#2a2a3e;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 36px;" align="center">
              <p style="margin:0 0 6px;font-size:14px;color:#e8e8f0;font-weight:600;">Team Hour Bit</p>
              <p style="margin:0 0 14px;font-size:12px;color:#5a5a7a;">Free Work Hours Tracker &amp; Leave Time Calculator</p>
            
            </td>
          </tr>

          <!-- Bottom accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#22d3a0,#7c6ef3);"></td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
    `,
  });
}