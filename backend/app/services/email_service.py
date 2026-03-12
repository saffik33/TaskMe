import os
from html import escape

from ..config import settings


def _build_verification_html(username: str, verification_url: str) -> str:
    safe_username = escape(username)
    safe_url = escape(verification_url)
    return f"""
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


async def _send_via_resend(to_email: str, subject: str, html_body: str):
    """Send email via Resend HTTP API (works on Railway)."""
    import resend
    resend.api_key = os.getenv("RESEND_API_KEY", "")
    from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    resend.Emails.send({
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    })


async def _send_via_smtp(to_email: str, subject: str, html_body: str):
    """Send email via SMTP (works locally with Gmail)."""
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    import aiosmtplib

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_FROM_EMAIL", settings.SMTP_FROM_EMAIL)
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    smtp_port = int(os.getenv("SMTP_PORT", str(settings.SMTP_PORT)))
    use_ssl = smtp_port == 465
    await aiosmtplib.send(
        msg,
        hostname=os.getenv("SMTP_HOST", settings.SMTP_HOST),
        port=smtp_port,
        username=os.getenv("SMTP_USER", settings.SMTP_USER),
        password=os.getenv("SMTP_PASSWORD", settings.SMTP_PASSWORD),
        start_tls=not use_ssl,
        use_tls=use_ssl,
    )


async def _send_email(to_email: str, subject: str, html_body: str):
    """Send email via Resend (if API key set) or SMTP (fallback for local dev)."""
    if os.getenv("RESEND_API_KEY"):
        await _send_via_resend(to_email, subject, html_body)
    else:
        await _send_via_smtp(to_email, subject, html_body)


async def send_verification_email(to_email: str, username: str, verification_url: str):
    html_body = _build_verification_html(username, verification_url)
    await _send_email(to_email, "TaskMe: Verify Your Email Address", html_body)


async def send_share_link_email(to_email: str, from_username: str, share_url: str, tasks: list):
    safe_user = escape(from_username)
    safe_url = escape(share_url)

    task_rows = ""
    for t in tasks:
        task_rows += f"""
            <tr>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">{escape(t.get('task_name', ''))}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">{escape(t.get('owner', '') or '—')}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">{escape(t.get('due_date', '') or '—')}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">{escape(t.get('status', ''))}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">{escape(t.get('priority', ''))}</td>
            </tr>"""

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">TaskMe</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;
                    border-radius: 0 0 8px 8px;">
            <p><strong>{safe_user}</strong> shared {len(tasks)} task(s) with you:</p>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; margin: 16px 0;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Task</th>
                        <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Owner</th>
                        <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Due Date</th>
                        <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Status</th>
                        <th style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Priority</th>
                    </tr>
                </thead>
                <tbody>{task_rows}</tbody>
            </table>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{safe_url}"
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white; padding: 12px 32px; border-radius: 8px;
                          text-decoration: none; font-weight: bold; display: inline-block;">
                    View Tasks
                </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                Sent via TaskMe - AI-Powered Task Management
            </p>
        </div>
    </body>
    </html>
    """
    await _send_email(to_email, f"TaskMe: {safe_user} shared tasks with you", html_body)


async def send_task_notification(
    to_email: str,
    owner_name: str,
    task_name: str,
    due_date: str,
    message: str,
):
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
    await _send_email(to_email, f"TaskMe: You have a task - {escape(task_name)}", html_body)


async def send_workspace_added_email(
    to_email: str, username: str, inviter_name: str, workspace_name: str, role: str
):
    safe_username = escape(username)
    safe_inviter = escape(inviter_name)
    safe_ws = escape(workspace_name)
    safe_role = escape(role)
    frontend_url = os.getenv("FRONTEND_URL", settings.FRONTEND_URL)

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
            <p><strong>{safe_inviter}</strong> added you as <strong>{safe_role}</strong> to the workspace <strong>{safe_ws}</strong>.</p>
            <p>You can now access this workspace and its tasks in TaskMe.</p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{escape(frontend_url)}"
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white; padding: 12px 32px; border-radius: 8px;
                          text-decoration: none; font-weight: bold; display: inline-block;">
                    Open TaskMe
                </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                Sent via TaskMe - AI-Powered Task Management
            </p>
        </div>
    </body>
    </html>
    """
    await _send_email(to_email, f"TaskMe: You were added to {safe_ws}", html_body)


async def send_workspace_invite_email(
    to_email: str, inviter_name: str, workspace_name: str, role: str, invite_url: str
):
    safe_inviter = escape(inviter_name)
    safe_ws = escape(workspace_name)
    safe_role = escape(role)
    safe_url = escape(invite_url)

    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">TaskMe</h1>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb;
                    border-radius: 0 0 8px 8px;">
            <p>Hi,</p>
            <p><strong>{safe_inviter}</strong> invited you to join the workspace <strong>{safe_ws}</strong> as <strong>{safe_role}</strong> on TaskMe.</p>
            <p>Create an account to start collaborating on tasks.</p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="{safe_url}"
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white; padding: 12px 32px; border-radius: 8px;
                          text-decoration: none; font-weight: bold; display: inline-block;">
                    Join TaskMe
                </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
                Or copy and paste this link in your browser:<br>
                <a href="{safe_url}" style="color: #667eea; word-break: break-all;">{safe_url}</a>
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                This invite expires in 7 days. If you weren't expecting this, you can ignore this email.
            </p>
        </div>
    </body>
    </html>
    """
    await _send_email(to_email, f"TaskMe: {safe_inviter} invited you to {safe_ws}", html_body)
