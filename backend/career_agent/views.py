from django.http import JsonResponse

def root_view(request):
    return JsonResponse({
        "message": "Welcome to the Career Agent API",
        "status": "Running",
        "endpoints": {
            "jobs": "/api/jobs/",
            "admin": "/admin/"
        }
    })
