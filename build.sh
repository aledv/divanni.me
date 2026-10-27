#!/bin/bash
# Builds the local image "divanni.me" (see docker-compose.yml). --force rebuilds it.
IMAGE_NAME="divanni.me"

FORCE_BUILD=false
if [[ "$1" == "--force" ]]; then
    FORCE_BUILD=true
fi

if [[ -n "$(docker images -q "$IMAGE_NAME")" && "$FORCE_BUILD" == false ]]; then
    echo "Image '$IMAGE_NAME' already exists. Use --force to rebuild it."
    exit 0
fi

echo "Building Docker image '$IMAGE_NAME'..."
docker build --no-cache -t "$IMAGE_NAME" .
