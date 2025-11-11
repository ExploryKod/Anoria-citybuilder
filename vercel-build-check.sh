#!/bin/bash
echo "Checking dist directory after build..."
if [ -d "dist" ]; then
  echo "dist directory exists"
  echo "HTML files in dist:"
  ls -la dist/*.html 2>/dev/null || echo "No HTML files found"
else
  echo "dist directory does not exist"
fi
