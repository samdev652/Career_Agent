#!/bin/bash

echo "Building project..."

# Install dependencies for both frontend and backend
# Backend
cd backend
python3 -m pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py collectstatic --noinput
cd ..

# Frontend
cd frontend
npm install
npm run build
cd ..

echo "Build complete!"
