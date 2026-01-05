#!/bin/bash

# Script to build and publish multi-platform Docker images to Docker Hub
# Supports: linux/amd64, linux/arm64
# Usage: ./publish-docker.sh [version]
# Example: ./publish-docker.sh v1.0.0

set -e

VERSION=${1:-latest}
DOCKER_USERNAME="leandrojm"
PLATFORMS="linux/amd64,linux/arm64"

echo "================================================"
echo "Publishing Bulk Migration to Docker Hub"
echo "Version: $VERSION"
echo "Platforms: $PLATFORMS"
echo "================================================"
echo ""

# Check if logged in to Docker Hub
echo "Checking Docker Hub login..."
if ! docker info | grep -q "Username: $DOCKER_USERNAME"; then
    echo "Please login to Docker Hub first:"
    docker login
fi

# Check if buildx is available
echo ""
echo "Checking Docker Buildx..."
if ! docker buildx version > /dev/null 2>&1; then
    echo "Error: Docker Buildx is not available."
    echo "Please update Docker to a version that supports Buildx."
    exit 1
fi

# Create or use existing buildx builder
echo "Setting up buildx builder..."
if ! docker buildx inspect multiplatform > /dev/null 2>&1; then
    echo "Creating new buildx builder 'multiplatform'..."
    docker buildx create --name multiplatform --use
else
    echo "Using existing buildx builder 'multiplatform'..."
    docker buildx use multiplatform
fi

# Bootstrap the builder
docker buildx inspect --bootstrap

echo ""
echo "Step 1/2: Building and pushing Backend (multi-platform)..."
echo "------------------------------------"
if [ "$VERSION" != "latest" ]; then
    docker buildx build \
        --platform $PLATFORMS \
        --tag ${DOCKER_USERNAME}/bulk-migration-backend:latest \
        --tag ${DOCKER_USERNAME}/bulk-migration-backend:${VERSION} \
        --push \
        ./bulk-migration-backend
    echo "✓ Built and pushed backend:latest and backend:${VERSION}"
else
    docker buildx build \
        --platform $PLATFORMS \
        --tag ${DOCKER_USERNAME}/bulk-migration-backend:latest \
        --push \
        ./bulk-migration-backend
    echo "✓ Built and pushed backend:latest"
fi

echo ""
echo "Step 2/2: Building and pushing Frontend (multi-platform)..."
echo "------------------------------------"
if [ "$VERSION" != "latest" ]; then
    docker buildx build \
        --platform $PLATFORMS \
        --tag ${DOCKER_USERNAME}/bulk-migration-frontend:latest \
        --tag ${DOCKER_USERNAME}/bulk-migration-frontend:${VERSION} \
        --push \
        ./bulk-migration-frontend
    echo "✓ Built and pushed frontend:latest and frontend:${VERSION}"
else
    docker buildx build \
        --platform $PLATFORMS \
        --tag ${DOCKER_USERNAME}/bulk-migration-frontend:latest \
        --push \
        ./bulk-migration-frontend
    echo "✓ Built and pushed frontend:latest"
fi

echo ""
echo "================================================"
echo "✓ Successfully published to Docker Hub!"
echo "================================================"
echo ""
echo "Images published (multi-platform: amd64, arm64):"
echo "  • ${DOCKER_USERNAME}/bulk-migration-backend:latest"
echo "  • ${DOCKER_USERNAME}/bulk-migration-frontend:latest"
if [ "$VERSION" != "latest" ]; then
    echo "  • ${DOCKER_USERNAME}/bulk-migration-backend:${VERSION}"
    echo "  • ${DOCKER_USERNAME}/bulk-migration-frontend:${VERSION}"
fi
echo ""
echo "To use these images:"
echo "  docker compose -f docker-compose.prod.yml up -d"
echo ""
echo "To verify multi-platform support:"
echo "  docker buildx imagetools inspect ${DOCKER_USERNAME}/bulk-migration-backend:latest"
echo "  docker buildx imagetools inspect ${DOCKER_USERNAME}/bulk-migration-frontend:latest"
echo ""
