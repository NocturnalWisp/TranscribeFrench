import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";

export const ZOHO_SMTP_PASSWORD = defineSecret("ZOHO_SMTP_PASSWORD");

export const ZOHO_MAILBOX = "hello@playlingolo.com";

export function getZohoTransporter() {
  return nodemailer.createTransport({
    host: "smtppro.zohocloud.ca",
    port: 465,
    secure: true,
    auth: {
      user: ZOHO_MAILBOX,
      pass: ZOHO_SMTP_PASSWORD.value()
    }
  });
}
