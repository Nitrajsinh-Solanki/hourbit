
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
      <h2>Verify Your Hour Bit Account</h2>

      <p>Your OTP code is:</p>

      <h1>${otp}</h1>

      <p>This OTP expires in 10 minutes.</p>

      <p>If you did not request this, ignore this email.</p>

      <br/>

      <p>Team Hour Bit</p>
    `,
  });
}