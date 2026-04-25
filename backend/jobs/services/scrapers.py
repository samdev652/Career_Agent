import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth


class JobScraper:
    def __init__(self):
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

    async def scrape_linkedin(self, keywords="Django", location="Kenya"):
        """
        Scrapes LinkedIn for job listings.
        Note: LinkedIn has heavy anti-bot measures. Using stealth and limited requests.
        """
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=self.user_agent)
            page = await context.new_page()
            await Stealth().apply_stealth_async(page)

            
            # Simple guest search URL (LinkedIn allows some guest browsing)
            url = f"https://www.linkedin.com/jobs/search/?keywords={keywords}&location={location}"
            await page.goto(url, wait_until="networkidle")
            
            # Extract job cards
            job_cards = await page.query_selector_all(".base-card")
            for card in job_cards[:10]: # Limit for demo purposes
                title = await card.query_selector(".base-search-card__title")
                company = await card.query_selector(".base-search-card__subtitle")
                link = await card.query_selector("a")
                
                if title and company and link:
                    results.append({
                        "title": (await title.inner_text()).strip(),
                        "company": (await company.inner_text()).strip(),
                        "url": await link.get_attribute("href"),
                        "source": "LinkedIn"
                    })
            
            await browser.close()
        return results

    async def scrape_brightermonday(self, keywords="Django"):
        """
        Scrapes BrighterMonday Kenya for jobs.
        """
        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=self.user_agent)
            page = await context.new_page()
            
            url = f"https://www.brightermonday.co.ke/jobs?q={keywords}"
            await page.goto(url, wait_until="domcontentloaded")
            
            # Adjust selectors based on actual site structure
            job_listings = await page.query_selector_all(".flex-1.p-4") # Example selector
            for job in job_listings[:10]:
                title_elem = await job.query_selector("p.text-lg")
                company_elem = await job.query_selector("p.text-sm")
                link_elem = await job.query_selector("a")
                
                if title_elem and company_elem and link_elem:
                    results.append({
                        "title": (await title_elem.inner_text()).strip(),
                        "company": (await company_elem.inner_text()).strip(),
                        "url": await link_elem.get_attribute("href"),
                        "source": "BrighterMonday"
                    })
            
            await browser.close()
        return results

# Service Wrapper
async def run_all_scrapers(keywords="Django", location="Kenya"):
    scraper = JobScraper()
    linkedin_jobs = await scraper.scrape_linkedin(keywords, location)
    brighter_jobs = await scraper.scrape_brightermonday(keywords)
    
    return linkedin_jobs + brighter_jobs
