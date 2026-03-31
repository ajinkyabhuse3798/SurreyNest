"""Email sending service for SurreyNest.

Uses stdlib smtplib via a thread-pool executor so it doesn't block
the async event loop. All SMTP settings come from app.config.settings.

In development (SMTP_HOST not set), emails are printed to the console
so developers can copy tokens without needing a mail server.
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

# ── HTML email template helpers ───────────────────────────────────────────────

_BASE_STYLES = """
  body { margin:0; padding:0; background:#f8f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width:560px; margin:32px auto; background:#ffffff; border-radius:16px;
          border:1px solid #e2e8f0; overflow:hidden; }
  .header { background:#ea871d; padding:28px 32px; }
  .header h1 { margin:0; color:#ffffff; font-size:22px; font-weight:800; letter-spacing:-0.3px; }
  .header p  { margin:4px 0 0; color:rgba(255,255,255,0.8); font-size:13px; }
  .body { padding:32px; color:#334155; font-size:15px; line-height:1.6; }
  .body p { margin:0 0 16px; }
  .btn { display:inline-block; background:#ea871d; color:#ffffff !important;
         text-decoration:none; padding:14px 28px; border-radius:10px;
         font-weight:700; font-size:14px; margin:8px 0 24px; }
  .token-box { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px;
               padding:12px 16px; font-family:monospace; font-size:13px;
               color:#475569; word-break:break-all; margin-bottom:24px; }
  .note { font-size:13px; color:#94a3b8; border-top:1px solid #f1f5f9; padding-top:16px; }
  .footer { padding:20px 32px; background:#f8f9fc; text-align:center;
            font-size:12px; color:#94a3b8; }
"""


def _html(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>{_BASE_STYLES}</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Surrey<span style="color:rgba(255,255,255,0.75)">Nest</span></h1>
      <p>Student housing intelligence for Guildford</p>
    </div>
    <div class="body">{body}</div>
    <div class="footer">
      &copy; SurreyNest &mdash; Built for University of Surrey students.<br>
      If you didn't request this email, you can safely ignore it.
    </div>
  </div>
</body>
</html>"""


def _verification_html(token: str) -> str:
    return _html(
        "Verify your SurreyNest email",
        f"""
      <p>Thanks for signing up to SurreyNest!</p>
      <p>Please enter the verification code below to confirm your email address. This code expires in <strong>24 hours</strong>.</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #ea871d; margin: 24px 0; text-align: center;">{token}</div>
      <p class="note">Didn't create a SurreyNest account? You can safely ignore this email.</p>
    """,
    )


def _reset_html(reset_url: str) -> str:
    return _html(
        "Reset your SurreyNest password",
        f"""
      <p>We received a request to reset the password for your SurreyNest account.</p>
      <p>Click the button below to choose a new password. This link expires in <strong>15 minutes</strong>.</p>
      <a href="{reset_url}" class="btn">Reset my password</a>
      <p class="note">Or copy this link into your browser:</p>
      <div class="token-box">{reset_url}</div>
      <p class="note">Didn't request a password reset? You can safely ignore this email &mdash; your password has not been changed.</p>
    """,
    )


# ── SMTP sender ───────────────────────────────────────────────────────────────


def _send_sync(to_email: str, subject: str, html_body: str) -> None:
    """Send an email synchronously (runs in a thread pool executor).

    If SMTP_HOST is not configured, logs the email content to the console
    so developers can test without a mail server.

    Args:
        to_email: Recipient email address.
        subject: Email subject line.
        html_body: HTML email body.
    """
    if not settings.smtp_host:
        # Dev mode: print to console instead of sending
        logger.info(
            "📧 [DEV, EMAIL NOT SENT] To: %s | Subject: %s\n"
            "SMTP not configured. Set SMTP_HOST in .env to send real emails.",
            to_email,
            subject,
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, to_email, msg.as_string())
        logger.info("Email sent to %s: %s", to_email, subject)
    except smtplib.SMTPException as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        raise


async def send_verification_email(to_email: str, token: str) -> None:
    """Send an email verification code asynchronously.

    Args:
        to_email: Recipient email address.
        token: 6-digit verification token.
    """
    html = _verification_html(token)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None, _send_sync, to_email, "Verify your SurreyNest email", html
    )


async def send_password_reset_email(to_email: str, token: str) -> None:
    """Send a password reset link asynchronously.

    Args:
        to_email: Recipient email address.
        token: Raw (unhashed) reset token.
    """
    url = f"{settings.frontend_url}/reset-password?token={token}"
    html = _reset_html(url)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None, _send_sync, to_email, "Reset your SurreyNest password", html
    )
