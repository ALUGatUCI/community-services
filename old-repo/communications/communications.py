import aiosmtplib
from configuration.configuration import read_config_file
from email.message import EmailMessage

async def send_email(
        subject: str,
        to: str,
        content: str
):
    """Send an email with a subject and a message"""
    email = read_config_file("email")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = email
    message["To"] = to
    message.set_content(content)

    smtp_host = read_config_file("smtp_host")
    smtp_port = int(read_config_file("smtp_port"))
    username = email
    password = read_config_file("email_key")

    await aiosmtplib.send(
        message,
        hostname=smtp_host,
        port=smtp_port,
        username=username,
        password=password,
        start_tls=True,
    )