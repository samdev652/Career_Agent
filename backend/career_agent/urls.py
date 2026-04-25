from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from jobs.views import JobViewSet
from profiles.views import UserProfileViewSet


router = DefaultRouter()
router.register(r'jobs', JobViewSet)
router.register(r'profiles', UserProfileViewSet)


from .views import root_view

urlpatterns = [
    path('', root_view),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]
