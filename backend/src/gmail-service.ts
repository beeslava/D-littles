// =========================================================
// D-LITTLES GMAIL API SERVICE
// =========================================================
//
// Sends email through the Gmail API using OAuth 2.0.
//
// Required environment variables:
//
// GMAIL_CLIENT_ID
// GMAIL_CLIENT_SECRET
// GMAIL_REFRESH_TOKEN
// GMAIL_SENDER_EMAIL
//
// IMPORTANT:
// These credentials must NEVER be placed in Angular/frontend
// code or committed to GitHub.
//
// =========================================================

interface GmailSendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GmailSendResponse {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

// =========================================================
// GET ENVIRONMENT VARIABLE
// =========================================================

function getRequiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `${name} is not configured on the backend.`
    );
  }

  return value;
}

// =========================================================
// GET GMAIL CONFIGURATION
// =========================================================

function getGmailClientId(): string {
  return getRequiredEnv("GMAIL_CLIENT_ID");
}

function getGmailClientSecret(): string {
  return getRequiredEnv("GMAIL_CLIENT_SECRET");
}

function getGmailRefreshToken(): string {
  return getRequiredEnv("GMAIL_REFRESH_TOKEN");
}

function getGmailSenderEmail(): string {
  return getRequiredEnv("GMAIL_SENDER_EMAIL");
}

// =========================================================
// HTML ESCAPE FOR HEADER VALUES
// =========================================================

function sanitizeHeaderValue(value: string): string {
  return String(value || "")
    .replace(/[\r\n]/g, "")
    .trim();
}

// =========================================================
// BASE64URL ENCODING
// =========================================================

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// =========================================================
// GET GOOGLE ACCESS TOKEN
// =========================================================
//
// The refresh token is used to obtain a short-lived access
// token whenever an email needs to be sent.
//
// =========================================================

async function getGoogleAccessToken(): Promise<string> {
  const clientId = getGmailClientId();
  const clientSecret = getGmailClientSecret();
  const refreshToken = getGmailRefreshToken();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  let data: GoogleTokenResponse | null = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.access_token) {
    const errorCode = data?.error || "unknown_error";
    const errorDescription =
      data?.error_description ||
      "No error description was returned by Google.";

    throw new Error(
      `Google OAuth token request failed: HTTP ${response.status} - ${errorCode} - ${errorDescription}`
    );
  }

  return data.access_token;
}

// =========================================================
// CREATE RFC 2822 / MIME MESSAGE
// =========================================================

function createRawEmail(
  options: GmailSendEmailOptions
): string {
  const sender = sanitizeHeaderValue(
    getGmailSenderEmail()
  );

  const recipient = sanitizeHeaderValue(
    options.to
  );

  const subject = sanitizeHeaderValue(
    options.subject
  );

  if (!recipient) {
    throw new Error(
      "Recipient email address is required."
    );
  }

  if (!subject) {
    throw new Error(
      "Email subject is required."
    );
  }

  if (!options.html) {
    throw new Error(
      "Email HTML content is required."
    );
  }

  // Encode the subject so special characters such as ₦
  // are handled correctly.
  const encodedSubject =
    `=?UTF-8?B?${Buffer.from(
      subject,
      "utf8"
    ).toString("base64")}?=`;

  const message = [
    `From: D Little Private School <${sender}>`,
    `To: ${recipient}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    options.html,
  ].join("\r\n");

  return base64UrlEncode(message);
}

// =========================================================
// SEND EMAIL THROUGH GMAIL API
// =========================================================

export async function sendGmailEmail(
  options: GmailSendEmailOptions
): Promise<{
  sent: boolean;
  messageId?: string;
}> {
  const sender = getGmailSenderEmail();

  const recipient = String(
    options.to || ""
  ).trim();

  if (!recipient) {
    return {
      sent: false,
    };
  }

  // -------------------------------------------------------
  // GET SHORT-LIVED GOOGLE ACCESS TOKEN
  // -------------------------------------------------------

  const accessToken =
    await getGoogleAccessToken();

  // -------------------------------------------------------
  // CREATE MIME MESSAGE
  // -------------------------------------------------------

  const raw = createRawEmail(options);

  // -------------------------------------------------------
  // SEND THROUGH GMAIL API
  // -------------------------------------------------------

  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw,
      }),
    }
  );

  let result: GmailSendResponse | null = null;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  // -------------------------------------------------------
  // DETAILED GMAIL API ERROR
  // -------------------------------------------------------

  if (!response.ok) {
    const apiCode =
      result?.error?.code ?? response.status;

    const apiStatus =
      result?.error?.status || "UNKNOWN_STATUS";

    const apiMessage =
      result?.error?.message ||
      "Unknown Gmail API error.";

    throw new Error(
      `Gmail API failed: HTTP ${apiCode} - ${apiStatus} - ${apiMessage}`
    );
  }

  // -------------------------------------------------------
  // SUCCESS
  // -------------------------------------------------------

  console.log(
    `Gmail email sent successfully from ${sender} to ${recipient}. Message ID: ${
      result?.id || "unknown"
    }`
  );

  return {
    sent: true,
    messageId: result?.id,
  };
}

