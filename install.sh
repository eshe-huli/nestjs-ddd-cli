#!/bin/bash

echo "🚀 Installing NestJS DDD CLI..."

# Install dependencies
npm install

# Build the project
npm run build

# Link globally
npm link

echo "✅ Installation complete!"
echo ""
echo "You can now use the 'ddd' command globally:"
echo "  ddd generate entity User -m user-management"
echo "  ddd scaffold Product -m inventory"
echo ""
echo "Run 'ddd --help' for more options"