#!/bin/sh

# If the env var is set, replace the placeholder in the code
if [ -n "$NEXT_PUBLIC_API_URL" ]; then
  echo "🚀 Runtime Injection: Replacing API URL with $NEXT_PUBLIC_API_URL"
  
  # Recursively find all JS files in .next folder and replace the string
  find .next -type f -name "*.js" -exec sed -i "s|REPLACE_ME_API_URL|$NEXT_PUBLIC_API_URL|g" {} +
else
  echo "⚠️  Warning: NEXT_PUBLIC_API_URL is not set. The app might try to connect to REPLACE_ME_API_URL."
fi

# Start the application
exec "$@"