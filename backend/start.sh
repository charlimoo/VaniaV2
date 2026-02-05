#!/bin/bash
set -e

# Define colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Vania Container Starting...${NC}"

# --- 1. DETERMINE SERVICE TYPE ---
# Check if this container is running the Web Server (Main App) or a Worker
CMD_STRING="$*"
IS_MAIN_APP=false

if [ "$#" -eq 0 ]; then
    # Default Dockerfile CMD
    IS_MAIN_APP=true
elif [[ "$CMD_STRING" == *"gunicorn"* ]] || [[ "$CMD_STRING" == *"uvicorn"* ]] || [[ "$CMD_STRING" == *"runserver"* ]]; then
    # Explicit server command
    IS_MAIN_APP=true
fi

# --- 2. MAIN APP STARTUP TASKS ---
if [ "$IS_MAIN_APP" = true ]; then
    echo -e "${YELLOW}📦 [Main App Detected] Running maintenance tasks...${NC}"

    # A. Migrations
    echo -e "${YELLOW}🔹 Applying Database Migrations...${NC}"
    python manage.py migrate --noinput

    # C. Static Files
    echo -e "${YELLOW}🔹 Collecting Static Files...${NC}"
    python manage.py collectstatic --noinput
    
    echo -e "${GREEN}✅ Startup tasks complete. Ready to boot server.${NC}"

else
    echo -e "${GREEN}⏩ [Worker/Beat Detected] Skipping migrations & sync.${NC}"
    # Small safety buffer to let the Main App finish migrations if restarting together
    sleep 5
fi

# --- 3. EXECUTE COMMAND ---
echo -e "${GREEN}🔥 Executing command...${NC}"

if [ "$#" -gt 0 ]; then
    # Execute passed command (e.g., gunicorn ... --preload)
    exec "$@"
else
    # Default fallback (Local Dev)
    echo -e "${GREEN}🚀 Starting Uvicorn Server...${NC}"
    exec uvicorn core.asgi:application --host 0.0.0.0 --port 8000 --reload
fi