import "dotenv/config";
import { google } from "googleapis";

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error(
    "GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be configured in .env"
  );
}

const redirectUri = "http://localhost:3000/oauth2callback";

const code = process.argv[2];

if (!code) {
  console.error("");
  console.error("========================================");
  console.error("GMAIL TOKEN EXCHANGE");
  console.error("========================================");
  console.error("");
  console.error(
    "Usage: npx tsx src/gmail-token.ts YOUR_AUTHORIZATION_CODE"
  );
  console.error("");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);

try {
  console.log("");
  console.log("Exchanging authorization code with Google...");
  console.log("");

  const { tokens } = await oauth2Client.getToken(code);

  console.log("========================================");
  console.log("GMAIL TOKEN EXCHANGE SUCCESSFUL");
  console.log("========================================");
  console.log("");

  if (tokens.refresh_token) {
    console.log("A new refresh token was generated.");
    console.log("");

    console.log("========================================");
    console.log("YOUR NEW REFRESH TOKEN");
    console.log("========================================");
    console.log("");

    console.log(tokens.refresh_token);

    console.log("");
    console.log("========================================");
    console.log("ADD THIS TO YOUR .env FILE");
    console.log("========================================");
    console.log("");
    console.log("GMAIL_REFRESH_TOKEN=<your-new-refresh-token>");
    console.log("");

    console.log("IMPORTANT:");
    console.log(
      "Keep this refresh token private. Do not send it to anyone."
    );
    console.log("");
  } else {
    console.log("Google did not return a refresh token.");
    console.log("");
    console.log(
      "Run the authorization process again with prompt=consent."
    );
    console.log("");
  }
} catch (error) {
  console.error("");
  console.error("========================================");
  console.error("GMAIL TOKEN EXCHANGE FAILED");
  console.error("========================================");
  console.error("");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  console.error("");
  process.exit(1);
}