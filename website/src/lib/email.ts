import "server-only";

import nodemailer from "nodemailer";

// Sends transactional email over SMTP using the configured credentials.
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured: set SMTP_HOST, SMTP_USER, SMTP_PASSWORD.",
    );
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: { user, pass },
  });

  await transport.sendMail({ from, to, subject, text });
}
