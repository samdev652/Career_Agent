from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Job
from .serializers import JobSerializer
from .tasks import fetch_and_evaluate_jobs
import threading

class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all().order_by('-compatibility_score')
    serializer_class = JobSerializer

    def get_queryset(self):
        queryset = Job.objects.all().order_by('-compatibility_score')
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(company__icontains=search) | 
                Q(description__icontains=search)
            )
        return queryset


    @action(detail=False, methods=['post'])
    def trigger_scrape(self, request):
        """
        Trigger the scraping process in a background thread
        """
        from profiles.models import UserProfile
        profile = UserProfile.objects.first()
        
        keywords = ""
        location = ""
        user_cv = ""
        
        if profile:
            keywords = ", ".join(profile.preferred_tech_stack) if profile.preferred_tech_stack else ""
            location = profile.location
            user_cv = profile.cv_text
        
        if not keywords:
            return Response({"error": "Please set your tech stack in your profile before matching."}, status=status.HTTP_400_BAD_REQUEST)

        # In a real production app, we would use fetch_and_evaluate_jobs.delay()
        thread = threading.Thread(
            target=fetch_and_evaluate_jobs, 
            kwargs={
                "keywords": keywords, 
                "location": location,
                "user_cv": user_cv
            }
        )
        thread.start()
        
        return Response({"status": f"Scraper started for {keywords}"}, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=['post'])
    def apply_with_ai(self, request, pk=None):
        """
        Generate a tailored cover letter for a specific job.
        """
        job = self.get_object()
        user_cv = request.data.get('cv_text')
        
        # If not provided in request, fetch from profile
        if not user_cv:
            from profiles.models import UserProfile
            profile = UserProfile.objects.first()
            if profile:
                user_cv = profile.cv_text
        
        if not user_cv:
            return Response({"error": "Please add your CV text in the Profile tab first so the AI can write a letter for you."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get additional data from request or profile
        portfolio_url = request.data.get('portfolio_url')
        linkedin_url = request.data.get('linkedin_url')
        base_letter = request.data.get('base_letter')
        
        from profiles.models import UserProfile
        profile = UserProfile.objects.first()
        
        if not portfolio_url and profile:
            portfolio_url = profile.portfolio_url
        if not linkedin_url and profile:
            linkedin_url = profile.linkedin_url
        if not base_letter and profile:
            base_letter = profile.base_application_letter

        # We can run this in a thread or call the client directly for responsiveness if it's fast
        try:
            from .ai_client import GrokClient
            grok = GrokClient()
            cover_letter = grok.generate_cover_letter(
                job.description or job.title, 
                user_cv, 
                portfolio_url=portfolio_url, 
                linkedin_url=linkedin_url,
                base_letter=base_letter
            )
            
            return Response({
                "job_title": job.title,
                "cover_letter": cover_letter
            })
        except Exception as e:
            return Response({
                "error": f"AI Application generation failed: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def toggle_save(self, request, pk=None):
        """
        Toggle the saved status of a job.
        """
        job = self.get_object()
        job.is_saved = not job.is_saved
        job.save()
        return Response({"is_saved": job.is_saved})

    @action(detail=False, methods=['get'])
    def stats(self, request):

        """
        Get statistics for the dashboard
        """
        total_jobs = Job.objects.count()
        high_match = Job.objects.filter(compatibility_score__gte=80).count()
        local_jobs = Job.objects.filter(location__icontains='Kenya').count() or Job.objects.filter(is_kenyan_friendly=True).count()
        
        return Response({
            "total_jobs": total_jobs,
            "high_match": high_match,
            "local_jobs": local_jobs,
            "engine_status": "Active"
        })

