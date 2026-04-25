import asyncio
import re
from celery import shared_task
from .models import Job
from .services.scrapers import run_all_scrapers
from .services.ingestion import RemotiveService, AdzunaService, RemoteOKService
from .ai_client import GrokClient
from .notifications import send_high_match_alert

@shared_task
def fetch_and_evaluate_jobs(keywords="Django", location="Kenya", user_cv=None):
    """
    Periodic task to fetch jobs from all sources and evaluate them using Grok.
    """
    grok = GrokClient()
    all_jobs_to_process = []

    # 1. Fetch from Remotive (API)
    print(f"Fetching from Remotive for {keywords}...")
    remotive = RemotiveService()
    # Remotive doesn't support fine-grained keywords via API easily, but we'll try
    for j in remotive.fetch_jobs():
        all_jobs_to_process.append({
            'title': j.get('title'),
            'company': j.get('company_name'),
            'url': j.get('url'),
            'source': 'Remotive',
            'description': j.get('description', ''),
            'location': j.get('candidate_required_location', 'Remote'),
            'salary': j.get('salary', 'Competitive')
        })
    
    # 2. Fetch from Adzuna (API)
    print(f"Fetching from Adzuna for {keywords} in {location}...")
    adzuna = AdzunaService()
    for j in adzuna.fetch_jobs(country="ke" if "Kenya" in location else "gb", keywords=keywords):
        all_jobs_to_process.append({
            'title': j.get('title'),
            'company': j.get('company', {}).get('display_name'),
            'url': j.get('redirect_url'),
            'source': 'Adzuna',
            'description': j.get('description', ''),
            'location': j.get('location', {}).get('display_name', 'Kenya'),
            'salary': f"{j.get('salary_min', '')} - {j.get('salary_max', '')}" if j.get('salary_min') else 'Competitive'
        })
    
    # 3. Fetch from RemoteOK (API)
    print(f"Fetching from RemoteOK...")
    remoteok = RemoteOKService()
    for j in remoteok.fetch_jobs():
        # Simple keywords filter for RemoteOK since API is broad
        title = j.get('position', '').lower()
        if any(kw.lower() in title for kw in keywords.split(',')):
            all_jobs_to_process.append({
                'title': j.get('position'),
                'company': j.get('company'),
                'url': j.get('url'),
                'source': 'RemoteOK',
                'description': j.get('description', ''),
                'location': j.get('location', 'Remote'),
                'salary': f"${j.get('salary_min', '')} - ${j.get('salary_max', '')}" if j.get('salary_min') else 'Competitive'
            })
    
    # 4. Run Scrapers
    print(f"Running Scrapers for {keywords}...")
    try:
        scraped_jobs = asyncio.run(run_all_scrapers(keywords=keywords, location=location))
        for j in scraped_jobs:
            all_jobs_to_process.append({
                'title': j.get('title'),
                'company': j.get('company'),
                'url': j.get('url'),
                'source': j.get('source', 'Scraper'),
                'description': j.get('description', j.get('title', '')), # Fallback to title
                'location': j.get('location', 'Remote'),
                'salary': j.get('salary', 'Competitive')
            })
    except Exception as e:
        print(f"Scraping failed: {e}")

    # 4. Save and Evaluate
    print(f"Total jobs to process: {len(all_jobs_to_process)}")
    for job_data in all_jobs_to_process:
        if not job_data.get('url'): continue

        # Clean HTML from description
        clean_description = re.sub(r'<[^>]*>', '', job_data['description'])
        clean_description = clean_description.replace('&nbsp;', ' ').replace('&amp;', '&').strip()

        job, created = Job.objects.update_or_create(
            url=job_data['url'],
            defaults={
                'title': job_data['title'],
                'company': job_data['company'],
                'source': job_data['source'],
                'description': clean_description,
                'location': job_data['location'],
                'salary': job_data['salary'],
            }
        )
        
        # Always evaluate if it's new or score is 0
        if created or job.compatibility_score == 0:
            print(f"Evaluating: {job.title}")
            try:
                evaluation = grok.evaluate_job(job.description or job.title, user_cv=user_cv)
                if evaluation:
                    is_tech = evaluation.get('is_tech_job', True)
                    if not is_tech:
                        print(f"Skipping non-tech job: {job.title}")
                        job.delete()
                        continue

                    job.tech_score = evaluation.get('tech_score', 0)
                    job.location_score = evaluation.get('location_score', 0)
                    job.compatibility_score = evaluation.get('compatibility_score', 0)
                    job.is_kenyan_friendly = evaluation.get('is_kenyan_friendly', False)
                    job.ai_summary = evaluation.get('summary', '')
                    job.raw_ai_evaluation = evaluation
                    job.save()

                    # Trigger email alert for high matches (> 70%)
                    if job.compatibility_score >= 70:
                        send_high_match_alert(job)
            except Exception as e:
                print(f"Evaluation failed for {job.title}: {e}")

    print("Task finished successfully")

@shared_task
def generate_application_support(job_id, user_cv):
    try:
        job = Job.objects.get(id=job_id)
        grok = GrokClient()
        cover_letter = grok.generate_cover_letter(job.description or job.title, user_cv)
        return cover_letter
    except Job.DoesNotExist:
        return "Job not found."
