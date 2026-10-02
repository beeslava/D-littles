import "dotenv/config";
import { google } from "googleapis";

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error(
    "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be configured."
  );
}

const redirectUri =
  "http://localhost:3000/oauth2callback";

const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/gmail.send",
  ],
});

console.log("");
console.log("========================================");
console.log("GMAIL AUTHORIZATION URL");
console.log("========================================");
console.log("");
console.log(authUrl);
console.log("");
console.log("========================================");
console.log("REDIRECT URI");
console.log("========================================");
console.log(redirectUri);
console.log("");
