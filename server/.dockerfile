# Ignore dependencies (let Docker install them inside the image)
node_modules/

# Ignore local environment files (pass vars via docker-compose or run args)
.env
.env.*
*.env

# Git & documentation
.git/
.gitignore
.github/
README.md
*.md

# Local build artifacts & cache
dist/
build/
.npm/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Test files & coverage
coverage/
tests/
__tests__/
*.test.ts
*.spec.ts

# IDE & OS files
.vscode/
.idea/
.DS_Store
Thumbs.db

# Docker files
Dockerfile
docker-compose*.yml
.dockerignore