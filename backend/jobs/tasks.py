import asyncio
import re
from celery import shared_task
from .models import Job
from .services.ingestion import RemotiveService, AdzunaService, RemoteOKService
from .ai_client import GrokClient
from .notifications import send_high_match_alert

# Tech keywords to pre-filter non-tech jobs before wasting AI calls
TECH_KEYWORDS = [
    'developer', 'engineer', 'software', 'frontend', 'backend', 'full stack',
    'fullstack', 'full-stack', 'devops', 'sre', 'data', 'python', 'django',
    'react', 'node', 'javascript', 'typescript', 'java', 'golang', 'go ',
    'rust', 'ruby', 'rails', 'php', 'laravel', 'vue', 'angular', 'next.js',
    'nextjs', 'aws', 'cloud', 'machine learning', 'ml ', 'ai ', 'ios',
    'android', 'mobile', 'flutter', 'kotlin', 'swift', 'postgres', 'sql',
    'api', 'microservice', 'docker', 'kubernetes', 'k8s', 'qa ', 'test',
    'automation', 'cicd', 'ci/cd', 'platform', 'infrastructure', 'security',
    'cyber', 'blockchain', 'web3', 'solidity', 'figma', 'ui/ux',
]

def is_likely_tech(title):
    """Quick pre-filter to avoid wasting AI calls on obviously non-tech jobs."""
    title_lower = title.lower() if title else ''
    return any(kw in title_lower for kw in TECH_KEYWORDS)


@shared_task
def fetch_and_evaluate_jobs(keywords="Django", location="Kenya", user_cv=None):
    """
    Periodic task to fetch jobs from all sources and evaluate them using AI.
    """
    ai = GrokClient()
    all_jobs_to_process = []

    # Split keywords for flexible matching
    keyword_list = [kw.strip().lower() for kw in keywords.split(',') if kw.strip()]

    # 1. Fetch from Remotive (API)
    print(f"Fetching from Remotive for {keywords}...")
    try:
        remotive = RemotiveService()
        for j in remotive.fetch_jobs():
            title = j.get('title', '')
            # Pre-filter: must match at least one keyword OR be a tech title
            title_lower = title.lower()
            if any(kw in title_lower for kw in keyword_list) or is_likely_tech(title):
                all_jobs_to_process.append({
                    'title': title,
                    'company': j.get('company_name'),
                    'url': j.get('url'),
                    'source': 'Remotive',
                    'description': j.get('description', ''),
                    'location': j.get('candidate_required_location', 'Remote'),
                    'salary': j.get('salary', 'Competitive')
                })
    except Exception as e:
        print(f"Remotive fetch failed: {e}")

    # 2. Fetch from Adzuna (API)
    print(f"Fetching from Adzuna for {keywords} in {location}...")
    try:
        adzuna = AdzunaService()
        # Search with each keyword separately for better results
        seen_urls = set()
        for kw in keyword_list[:3]:  # Limit to top 3 keywords to avoid rate limits
            for j in adzuna.fetch_jobs(country="ke" if "Kenya" in location else "gb", keywords=kw):
                url = j.get('redirect_url')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_jobs_to_process.append({
                        'title': j.get('title'),
                        'company': j.get('company', {}).get('display_name'),
                        'url': url,
                        'source': 'Adzuna',
                        'description': j.get('description', ''),
                        'location': j.get('location', {}).get('display_name', 'Kenya'),
                        'salary': f"{j.get('salary_min', '')} - {j.get('salary_max', '')}" if j.get('salary_min') else 'Competitive'
                    })
    except Exception as e:
        print(f"Adzuna fetch failed: {e}")

    # 3. Fetch from RemoteOK (API)
    print(f"Fetching from RemoteOK...")
    try:
        remoteok = RemoteOKService()
        for j in remoteok.fetch_jobs():
            title = j.get('position', '')
            tags = ' '.join(j.get('tags', []) if isinstance(j.get('tags'), list) else []).lower()
            title_lower = title.lower()

            # Match against keywords OR tags OR if it's a tech title
            if any(kw in title_lower or kw in tags for kw in keyword_list) or is_likely_tech(title):
                all_jobs_to_process.append({
                    'title': title,
                    'company': j.get('company'),
                    'url': j.get('url'),
                    'source': 'RemoteOK',
                    'description': j.get('description', ''),
                    'location': j.get('location', 'Remote'),
                    'salary': f"${j.get('salary_min', '')} - ${j.get('salary_max', '')}" if j.get('salary_min') else 'Competitive'
                })
    except Exception as e:
        print(f"RemoteOK fetch failed: {e}")

    # 4. Run Playwright scrapers (skip on Render — no browser available)
    print(f"Running Scrapers for {keywords}...")
    try:
        from .services.scrapers import run_all_scrapers
        scraped_jobs = asyncio.run(run_all_scrapers(keywords=keywords, location=location))
        for j in scraped_jobs:
            all_jobs_to_process.append({
                'title': j.get('title'),
                'company': j.get('company'),
                'url': j.get('url'),
                'source': j.get('source', 'Scraper'),
                'description': j.get('description', j.get('title', '')),
                'location': j.get('location', 'Remote'),
                'salary': j.get('salary', 'Competitive')
            })
    except Exception as e:
        print(f"Scraping skipped (likely no browser on server): {e}")

    # 5. Pre-filter: only keep jobs with tech-related titles
    before_count = len(all_jobs_to_process)
    all_jobs_to_process = [j for j in all_jobs_to_process if is_likely_tech(j.get('title', ''))]
    print(f"Pre-filtered: {before_count} → {len(all_jobs_to_process)} tech jobs")

    # 6. Save and Evaluate
    print(f"Total tech jobs to process: {len(all_jobs_to_process)}")
    saved_count = 0
    for job_data in all_jobs_to_process:
        if not job_data.get('url'):
            continue

        # Clean HTML from description
        clean_description = re.sub(r'<[^>]*>', '', job_data.get('description', ''))
        clean_description = clean_description.replace('&nbsp;', ' ').replace('&amp;', '&').strip()
        # Truncate description to avoid huge AI prompts
        if len(clean_description) > 2000:
            clean_description = clean_description[:2000] + "..."

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

        # Evaluate with AI if new or not yet scored
        if created or job.compatibility_score == 0:
            print(f"Evaluating: {job.title}")
            try:
                evaluation = ai.evaluate_job(job.description or job.title, user_cv=user_cv)
                if evaluation:
                    is_tech = evaluation.get('is_tech_job', True)
                    if not is_tech:
                        print(f"  → AI confirmed non-tech, removing: {job.title}")
                        job.delete()
                        continue

                    job.tech_score = evaluation.get('tech_score', 0)
                    job.location_score = evaluation.get('location_score', 0)
                    job.compatibility_score = evaluation.get('compatibility_score', 0)
                    job.is_kenyan_friendly = evaluation.get('is_kenyan_friendly', False)
                    job.ai_summary = evaluation.get('summary', '')
                    job.raw_ai_evaluation = evaluation
                    job.save()
                    saved_count += 1
                    print(f"  → Scored: {job.compatibility_score}% match")

                    # Trigger email alert for high matches (> 70%)
                    if job.compatibility_score >= 70:
                        send_high_match_alert(job)
            except Exception as e:
                print(f"Evaluation failed for {job.title}: {e}")
                # Still keep the job, just without AI scores
                saved_count += 1

    print(f"Task finished: {saved_count} jobs saved/updated")

@shared_task
def generate_application_support(job_id, user_cv):
    try:
        job = Job.objects.get(id=job_id)
        ai = GrokClient()
        cover_letter = ai.generate_cover_letter(job.description or job.title, user_cv)
        return cover_letter
    except Job.DoesNotExist:
        return "Job not found."
