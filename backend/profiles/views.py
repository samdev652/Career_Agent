from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import UserProfile
from .serializers import UserProfileSerializer
from django.contrib.auth.models import User

class UserProfileViewSet(viewsets.ModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer

    @action(detail=False, methods=['get', 'patch'])
    def me(self, request):
        """
        Custom action to get/update the current user's profile.
        For now, we'll use the first user in the system as 'me'.
        """
        user = User.objects.first()
        if not user:
            user = User.objects.create_user(username='User', email='user@example.com')
        
        profile, created = UserProfile.objects.get_or_create(user=user)
        
        if request.method == 'PATCH':
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        
        serializer = self.get_serializer(profile)
        return Response(serializer.data)
