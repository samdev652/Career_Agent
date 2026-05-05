import os
import json
import re
from dotenv import load_dotenv

load_dotenv(override=True)


class AIClient:
    """
    Multi-provider AI client with automatic fallback.
    Priority: Groq (free) → Gemini (free tier) → Grok (paid)
    """
    def __init__(self):
        # Re-read .env to pick up any changes without needing full restart
        load_dotenv(override=True)
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.gemini_key = os.getenv("GEMINI_API_KEY")
        self.grok_key = os.getenv("GROK_API_KEY")
        self._provider = None

        providers = []
        if self.groq_key:
            providers.append("Groq ✅")
        if self.gemini_key:
            providers.append("Gemini ✅")
        if self.grok_key:
            providers.append("Grok ✅")
        print(f"🤖 AI Client initialized — Providers: {', '.join(providers) or 'NONE ❌'}")

    # ─── Provider: Groq (Primary — free, fast) ───────────────────────
    def _call_groq(self, prompt, use_json=False):
        """Call Groq API with Llama model."""
        from groq import Groq
        client = Groq(api_key=self.groq_key)

        params = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.6,
            "max_tokens": 2048,
        }
        if use_json:
            params["response_format"] = {"type": "json_object"}

        response = client.chat.completions.create(**params)
        text = response.choices[0].message.content

        if use_json:
            # Clean potential markdown fences
            text = re.sub(r"^```json\s*", "", text.strip())
            text = re.sub(r"\s*```$", "", text.strip())
            return json.loads(text)
        return text

    # ─── Provider: Gemini (Fallback 1 — free tier) ───────────────────
    def _call_gemini(self, prompt, use_json=False):
        """Call Google Gemini API."""
        import google.generativeai as genai
        genai.configure(api_key=self.gemini_key)

        generation_config = {}
        if use_json:
            generation_config["response_mime_type"] = "application/json"

        model = genai.GenerativeModel(
            "gemini-2.0-flash",
            generation_config=generation_config if generation_config else None,
        )
        response = model.generate_content(prompt)
        text = response.text

        if use_json:
            text = re.sub(r"^```json\s*", "", text.strip())
            text = re.sub(r"\s*```$", "", text.strip())
            return json.loads(text)
        return text

    # ─── Provider: Grok (Fallback 2 — paid) ──────────────────────────
    def _call_grok(self, prompt, use_json=False):
        """Call xAI Grok API via OpenAI-compatible client."""
        from openai import OpenAI
        client = OpenAI(
            api_key=self.grok_key,
            base_url="https://api.x.ai/v1",
        )
        models = ["grok-2", "grok-beta"]
        last_error = None

        for model_name in models:
            try:
                params = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}]
                }
                if use_json:
                    params["response_format"] = {"type": "json_object"}

                response = client.chat.completions.create(**params)

                if use_json:
                    return json.loads(response.choices[0].message.content)
                return response.choices[0].message.content
            except Exception as e:
                last_error = e
                if "Model not found" in str(e) or "invalid argument" in str(e).lower():
                    continue
                raise e

        raise last_error

    # ─── Unified call with fallback chain ─────────────────────────────
    def _call_ai(self, prompt, use_json=False):
        """
        Call AI with automatic fallback chain:
        1. Groq (free, fast, Llama 3.3 70B)
        2. Gemini (free tier, Google)
        3. Grok (paid, xAI)
        """
        errors = []

        # --- Primary: Groq ---
        if self.groq_key:
            try:
                result = self._call_groq(prompt, use_json=use_json)
                self._provider = "Groq"
                print(f"✅ AI response via Groq")
                return result
            except Exception as e:
                errors.append(f"Groq: {e}")
                print(f"⚠️ Groq failed: {e}")

        # --- Fallback 1: Gemini ---
        if self.gemini_key:
            try:
                result = self._call_gemini(prompt, use_json=use_json)
                self._provider = "Gemini"
                print(f"✅ AI response via Gemini")
                return result
            except Exception as e:
                errors.append(f"Gemini: {e}")
                print(f"⚠️ Gemini failed: {e}")

        # --- Fallback 2: Grok ---
        if self.grok_key and self.grok_key != "your_grok_api_key":
            try:
                result = self._call_grok(prompt, use_json=use_json)
                self._provider = "Grok"
                print(f"✅ AI response via Grok")
                return result
            except Exception as e:
                errors.append(f"Grok: {e}")
                print(f"⚠️ Grok failed: {e}")

        # --- All failed ---
        error_detail = " | ".join(errors) if errors else "No API keys configured"
        raise Exception(
            f"All AI providers failed. Set GROQ_API_KEY in your .env file. "
            f"Get a free key at https://console.groq.com/keys — Details: {error_detail}"
        )

    def evaluate_job(self, job_description, user_cv=None):
        """
        Evaluates a job against the user's CV using AI.
        """
        prompt = (
            f"Analyze this job description: {job_description}\n\n"
            f"Against this user CV: {user_cv}\n\n"
            f"Provide a JSON evaluation with tech_score, location_score, "
            f"compatibility_score, is_kenyan_friendly, is_tech_job (boolean), "
            f"and a brief summary. IMPORTANT: If this is not a software engineering, "
            f"data, or technical tech role (e.g. Office Assistant, Driver, Marketing, etc.), "
            f"set is_tech_job to false and all scores to 0."
        )
        return self._call_ai(prompt, use_json=True)

    def generate_cover_letter(self, job_description, user_cv, portfolio_url=None, linkedin_url=None, base_letter=None):
        """
        Generates a tailored cover letter using AI.
        """
        prompt = f"Job Description: {job_description}\n\nUser CV: {user_cv}\n\n"
        if portfolio_url:
            prompt += f"User Portfolio: {portfolio_url}\n\n"
        if linkedin_url:
            prompt += f"User LinkedIn: {linkedin_url}\n\n"

        if base_letter:
            prompt += (
                f"Base Letter to Refine: {base_letter}\n\n"
                f"Instruction: Please refine the base letter above to perfectly match "
                f"the job description, incorporating details from the CV and mentioning "
                f"the portfolio if relevant. Keep it professional and high-converting."
            )
        else:
            prompt += (
                "Instruction: Write a professional, high-converting cover letter from "
                "scratch that matches the job description and highlights the user's CV "
                "and portfolio projects."
            )

        return self._call_ai(prompt, use_json=False)


# Backward-compatible alias so existing imports still work
GrokClient = AIClient
