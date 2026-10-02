import "dotenv/config";
import { sendGmailEmail } from "./gmail-service.js";

async function main() {
  const recipient = process.argv[2];

  if (!recipient) {
    console.error(
      "Usage: npm run gmail:test -- your-email@example.com"
    );
    process.exit(1);
  }

  console.log(`Sending test Gmail to: ${recipient}`);

  try {
    const result = await sendGmailEmail({
      to: recipient,
      subject: "D Little Private School - Gmail API Test",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>D Little Private School</h2>

          <p>Hello,</p>

          <p>
            This is a test email from the D Little Private School
            backend using the Gmail API.
          </p>

          <p>
            If you received this message, the Gmail API integration
            is working correctly.
          </p>

          <p>
            <strong>Sender:</strong>
            internationalschooldlittles@gmail.com
          </p>

          <p>
            D Little Private School
          </p>
        </div>
      `,
    });

    console.log("========================================");
    console.log("GMAIL TEST SUCCESSFUL");
    console.log("========================================");
    console.log("Sent:", result.sent);
    console.log("Message ID:", result.messageId);
  } catch (error) {
    console.error("========================================");
    console.error("GMAIL TEST FAILED");
    console.error("========================================");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

main();

