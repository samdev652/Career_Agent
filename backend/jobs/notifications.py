from django.core.mail import send_mail
from django.conf import settings
from .models import Job

def send_high_match_alert(job):
    """
    Sends an email alert for a high-match job.
    """
    subject = f"🔥 High Match Found: {job.title} at {job.company}"
    
    body = f"""
Hello Sam,

A new high-match tech role has been discovered by your agent!

Role: {job.title}
Company: {job.company}
Match Score: {job.compatibility_score}%
Location: {job.location}
Salary: {job.salary}

AI Summary:
{job.ai_summary}

View Job: {job.url}

Apply now before it's gone!

Best,
Your Career Agent
    """
    
    recipient = getattr(settings, 'NOTIFICATION_EMAIL', 'developersam652@gmail.com')
    sender = settings.DEFAULT_FROM_EMAIL
    
    try:
        send_mail(
            subject,
            body,
            sender,
            [recipient],
            fail_silently=False,
        )
        print(f"Email alert sent to {recipient} for {job.title}")
    except Exception as e:
        print(f"Failed to send email alert: {e}")

def send_job_digest(jobs):
    """
    Sends a digest of multiple jobs.
    """
    if not jobs:
        return

    subject = f"🚀 {len(jobs)} New Tech Roles for You"
    
    roles_text = ""
    for job in jobs:
        roles_text += f"- {job.title} @ {job.company} ({job.compatibility_score}% Match)\n  Link: {job.url}\n\n"

    body = f"""
Hello Sam,

Your agent found {len(jobs)} new roles today that match your profile.

{roles_text}

Check your dashboard for full details and AI-tailored cover letters.

Best,
Your Career Agent
    """
    
    recipient = getattr(settings, 'NOTIFICATION_EMAIL', 'developersam652@gmail.com')
    sender = settings.DEFAULT_FROM_EMAIL
    
    try:
        send_mail(
            subject,
            body,
            sender,
            [recipient],
            fail_silently=False,
        )
    except Exception as e:
        print(f"Failed to send digest email: {e}")
