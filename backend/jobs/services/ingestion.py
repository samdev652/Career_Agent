import requests
import os
from dotenv import load_dotenv

load_dotenv()

class RemotiveService:
    BASE_URL = "https://remotive.com/api/remote-jobs"

    def fetch_jobs(self, category="software-dev"):
        """
        Fetches jobs from Remotive API.
        Gets software-dev category and accepts any location (all remote jobs).
        """
        try:
            params = {"category": category, "limit": 50}
            response = requests.get(self.BASE_URL, params=params, timeout=15)
            
            if response.status_code == 200:
                return response.json().get("jobs", [])
        except requests.RequestException as e:
            print(f"Remotive API error: {e}")
        return []

class AdzunaService:
    BASE_URL = "https://api.adzuna.com/v1/api/jobs"

    def __init__(self):
        self.app_id = os.getenv("ADZUNA_APP_ID")
        self.api_key = os.getenv("ADZUNA_API_KEY")

    def fetch_jobs(self, country="ke", keywords="remote"):
        """
        Fetches jobs from Adzuna API for a specific country.
        """
        if not self.app_id or not self.api_key:
            print("Adzuna API credentials not configured")
            return []

        try:
            url = f"{self.BASE_URL}/{country}/search/1"
            params = {
                "app_id": self.app_id,
                "app_key": self.api_key,
                "what": keywords,
                "results_per_page": 20,
                "content-type": "application/json"
            }
            
            response = requests.get(url, params=params, timeout=15)
            if response.status_code == 200:
                return response.json().get("results", [])
        except requests.RequestException as e:
            print(f"Adzuna API error: {e}")
        return []

class RemoteOKService:
    BASE_URL = "https://remoteok.com/api"

    def fetch_jobs(self):
        """
        Fetches jobs from RemoteOK API.
        Note: RemoteOK returns a list where the first element is legal info.
        """
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            response = requests.get(self.BASE_URL, headers=headers, timeout=15)
            
            if response.status_code == 200:
                all_jobs = response.json()
                if isinstance(all_jobs, list) and len(all_jobs) > 1:
                    return all_jobs[1:]  # Skip first legal/info element
        except requests.RequestException as e:
            print(f"RemoteOK API error: {e}")
        return []
