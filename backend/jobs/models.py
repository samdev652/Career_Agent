from django.db import models
from django.contrib.auth.models import User

class Job(models.Model):
    SOURCE_CHOICES = [
        ('REMOTIVE', 'Remotive'),
        ('ADZUNA', 'Adzuna'),
        ('LINKEDIN', 'LinkedIn'),
        ('BRIGHTERMONDAY', 'BrighterMonday'),
    ]

    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255)
    description = models.TextField()
    url = models.URLField(unique=True, max_length=500)
    source = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    location = models.CharField(max_length=255, null=True, blank=True)
    salary = models.CharField(max_length=255, null=True, blank=True)
    posted_date = models.DateTimeField(auto_now_add=True)
    
    # AI Evaluation Fields
    tech_score = models.IntegerField(default=0)
    location_score = models.IntegerField(default=0)
    compatibility_score = models.IntegerField(default=0)
    is_kenyan_friendly = models.BooleanField(default=False)
    ai_summary = models.TextField(blank=True, null=True)
    raw_ai_evaluation = models.JSONField(blank=True, null=True)
    is_saved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} at {self.company}"
