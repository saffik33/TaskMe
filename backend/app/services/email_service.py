from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape

import aiosmtplib

from ..config import settings


async def send_verification_email(to_email: str, username: str, verification_url: str):
    import os
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "TaskMe: Verify Your Email Address"
    msg["From"] = os.getenv("SMTP_FROM_EMAIL", settings.SMTP_FROM_EMAIL)
    msg["To"] = to_email

    safe_username = escape(username)
    safe_url = escape(verification_url)

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">TaskMe</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;
                    border-radius: 0 0 8px 8px;">
            <p>Hi <strong>{safe_username}</strong>,</p>
            <p>Welcome to TaskMe! Please verify your email address to activate your account.</p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{safe_url}"
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white; padding: 12px 32px; border-radius: 8px;
                          text-decoration: none; font-weight: bold; display: inline-block;">
                    Verify My Email
                </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
                Or copy and paste this link in your browser:<br>
                <a href="{safe_url}" style="color: #667eea; word-break: break-all;">{safe_url}</a>
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                This link expires in 24 hours. If you didn't create an account, you can ignore this email.
            </p>
        </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_body, "html"))

    import os
    await aiosmtplib.send(
        msg,
        hostname=os.getenv("SMTP_HOST", settings.SMTP_HOST),
        port=int(os.getenv("SMTP_PORT", str(settings.SMTP_PORT))),
        username=os.getenv("SMTP_USER", settings.SMTP_USER),
        password=os.getenv("SMTP_PASSWORD", settings.SMTP_PASSWORD),
        start_tls=True,
    )


async def send_task_notification(
    to_email: str,
    owner_name: str,
    task_name: str,
    due_date: str,
    message: str,
):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"TaskMe: You have a task - {escape(task_name)}"
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email

    safe_owner = escape(owner_name)
    safe_task = escape(task_name)
    safe_due = escape(due_date or "No due date set")
    safe_message = escape(message) if message else ""

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">TaskMe</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;
                    border-radius: 0 0 8px 8px;">
            <p>Hi <strong>{safe_owner}</strong>,</p>
            <p>You have been assigned a task:</p>
            <div style="background: white; padding: 16px; border-radius: 8px;
                        border-left: 4px solid #667eea; margin: 16px 0;">
                <h3 style="margin: 0 0 8px 0; color: #1f2937;">{safe_task}</h3>
                <p style="margin: 0; color: #6b7280;">
                    <strong>Due:</strong> {safe_due}
                </p>
            </div>
            {f'<p style="color: #374151;">{safe_message}</p>' if safe_message else ''}
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                Sent via TaskMe Task Manager
            </p>
        </div>
    </body>
    </html>
    """
    msg.attach(MIMEText(html_body, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )
