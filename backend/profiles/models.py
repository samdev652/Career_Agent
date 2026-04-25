from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    cv_text = models.TextField(blank=True, null=True)
    preferred_tech_stack = models.JSONField(default=list) # e.g., ["Django", "Next.js"]
    location = models.CharField(max_length=255, default="Kenya")
    target_salary = models.CharField(max_length=100, blank=True, null=True)
    portfolio_url = models.URLField(max_length=500, blank=True, null=True)
    linkedin_url = models.URLField(max_length=500, blank=True, null=True)
    base_application_letter = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.user.username


# Create your models here.
