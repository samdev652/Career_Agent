import os
import json
import random
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

class GrokClient:
    """
    Client for interacting with xAI's Grok API.
    """
    def __init__(self):
        self.api_key = os.getenv("GROK_API_KEY")
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.x.ai/v1",
        )

    def _call_grok(self, prompt, use_json=False):
        """
        Internal helper to call Grok with multiple fallback model names.
        """
        models = ["grok-2", "grok-beta", "grok-2-1212", "grok-4.20"]
        last_error = None

        for model_name in models:
            try:
                params = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}]
                }
                if use_json:
                    params["response_format"] = {"type": "json_object"}
                
                response = self.client.chat.completions.create(**params)
                
                if use_json:
                    return json.loads(response.choices[0].message.content)
                return response.choices[0].message.content
            except Exception as e:
                last_error = e
                # If it's a 400 'model not found', try the next one
                if "Model not found" in str(e) or "invalid argument" in str(e).lower():
                    continue
                # If it's something else (like auth), raise it
                raise e
        
        raise last_error

    def evaluate_job(self, job_description, user_cv=None):
        """
        Evaluates a job against the user's CV using Grok API.
        """
        if not self.api_key or self.api_key == "your_grok_api_key":
            raise Exception("GROK_API_KEY is not configured. Please add it to your .env file.")

        prompt = f"Analyze this job description: {job_description}\n\nAgainst this user CV: {user_cv}\n\nProvide a JSON evaluation with tech_score, location_score, compatibility_score, is_kenyan_friendly, is_tech_job (boolean), and a brief summary. IMPORTANT: If this is not a software engineering, data, or technical tech role (e.g. Office Assistant, Driver, Marketing, etc.), set is_tech_job to false and all scores to 0."
        
        return self._call_grok(prompt, use_json=True)

    def generate_cover_letter(self, job_description, user_cv, portfolio_url=None, linkedin_url=None, base_letter=None):
        """
        Generates a tailored cover letter using Grok API.
        """
        if not self.api_key or self.api_key == "your_grok_api_key":
            raise Exception("GROK_API_KEY is not configured. Please add it to your .env file.")

        prompt = f"Job Description: {job_description}\n\nUser CV: {user_cv}\n\n"
        if portfolio_url:
            prompt += f"User Portfolio: {portfolio_url}\n\n"
        if linkedin_url:
            prompt += f"User LinkedIn: {linkedin_url}\n\n"
        
        if base_letter:
            prompt += f"Base Letter to Refine: {base_letter}\n\nInstruction: Please refine the base letter above to perfectly match the job description, incorporating details from the CV and mentioning the portfolio if relevant. Keep it professional and high-converting."
        else:
            prompt += "Instruction: Write a professional, high-converting cover letter from scratch that matches the job description and highlights the user's CV and portfolio projects."
        
        return self._call_grok(prompt, use_json=False)
