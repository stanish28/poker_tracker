const nodemailer = require('nodemailer');

/**
 * Email notification service for Poker Tracker.
 * Uses Gmail SMTP via Nodemailer.
 * Requires EMAIL_USER and EMAIL_PASS (Gmail App Password) env vars.
 * All functions are safe — they never throw. Failures are logged and swallowed.
 */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Send a game result email to a player.
 * @param {string} playerEmail - Recipient email address
 * @param {string} playerName - Player's display name
 * @param {Object} result - Game result details
 * @param {number} result.buyin - Buy-in amount
 * @param {number} result.cashout - Cash-out amount
 * @param {number} result.profit - Net profit (can be negative)
 * @param {string} result.date - Game date (ISO string or YYYY-MM-DD)
 */
async function sendGameResultEmail(playerEmail, playerName, { buyin, cashout, profit, date }) {
  try {
    const transport = getTransporter();
    if (!transport) {
      // Email not configured — silently skip
      return;
    }

    if (!playerEmail) return;

    const isProfit = profit >= 0;
    const color = isProfit ? '#16a34a' : '#dc2626';
    const sign = isProfit ? '+' : '';
    const emoji = isProfit ? '🎉' : '📉';
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 0;">
        <div style="background: ${color}; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">${emoji} Poker Game Result</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">${formattedDate}</p>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px; font-size: 16px; color: #374151;">
            Hey <strong>${playerName}</strong>, here's your result:
          </p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Buy-in</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; font-size: 14px;">$${parseFloat(buyin).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Cash-out</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; font-size: 14px;">$${parseFloat(cashout).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Net Result</td>
              <td style="padding: 10px 0; text-align: right; font-weight: 700; font-size: 18px; color: ${color};">${sign}$${Math.abs(profit).toFixed(2)}</td>
            </tr>
          </table>
          <p style="margin: 20px 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
            Sent by Poker Tracker • Do not reply
          </p>
        </div>
      </div>
    `;

    await transport.sendMail({
      from: `"Poker Tracker" <${process.env.EMAIL_USER}>`,
      to: playerEmail,
      subject: `${emoji} Poker Result: ${sign}$${Math.abs(profit).toFixed(2)} — ${formattedDate}`,
      html,
    });

    console.log(`📧 Email sent to ${playerName} (${playerEmail})`);
  } catch (error) {
    console.error(`📧 Failed to send email to ${playerName} (${playerEmail}):`, error.message);
    // Never throw — email failures must not crash the app
  }
}

module.exports = { sendGameResultEmail };
