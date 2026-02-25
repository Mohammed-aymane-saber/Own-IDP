FROM codercom/code-server:latest

USER root

# Installer PHP + extensions + Composer + Git
RUN apt-get update && \
    apt-get install -y php php-cli php-mbstring php-xml php-curl php-zip php-bcmath php-json unzip git curl && \
    rm -rf /var/lib/apt/lists/*

# Installer Composer
RUN curl -sS https://getcomposer.org/installer | php && \
    mv composer.phar /usr/local/bin/composer

# Créer dossier parent
RUN mkdir -p /home/coder
WORKDIR /home/coder

# Installer Laravel via Composer (cela créera le dossier 'project')
RUN composer create-project --prefer-dist laravel/laravel project-laravel

# Se déplacer dans le projet
WORKDIR /home/coder/project-laravel

# Configurer les permissions Laravel
RUN chown -R coder:coder /home/coder/project-laravel && \
    chmod -R 755 /home/coder/project-laravel/storage && \
    chmod -R 755 /home/coder/project-laravel/bootstrap/cache

# Créer un fichier README personnalisé
# Configurer VS Code pour le lancement automatique
RUN mkdir -p /home/coder/project-laravel/.vscode && \
    printf '{\n    "version": "2.0.0",\n    "tasks": [\n        {\n            "label": "Auto-Start Server",\n            "type": "shell",\n            "command": "php artisan serve --host=0.0.0.0 --port=${env:PREVIEW_PORT}",\n            "runOptions": { "runOn": "folderOpen" },\n            "presentation": { "reveal": "always", "panel": "new" },\n            "group": { "kind": "build", "isDefault": true }\n        }\n    ]\n}' > /home/coder/project-laravel/.vscode/tasks.json && \
    printf '{\n    "task.allowAutomaticTasks": "on",\n    "security.workspace.trust.enabled": false\n}' > /home/coder/project-laravel/.vscode/settings.json && \
    chown -R coder:coder /home/coder/project-laravel/.vscode

# Créer un fichier README
RUN printf "# Laravel Project\n\n## Getting Started\n\nTo see your app in the Live Preview, the server starts automatically.\nIf it doesn't, run:\n\`\`\`bash\nphp artisan serve --host=0.0.0.0 --port=\$PREVIEW_PORT\n\`\`\`\n" > README_LARAVEL.md

# Installer Docker CLI (pour que le client puisse gérer des conteneurs)
RUN apt-get update && apt-get install -y docker.io

# Générer automatiquement un Dockerfile pour l'application Laravel du client
RUN echo 'FROM php:8.2-cli\n\
    RUN apt-get update && apt-get install -y git zip unzip libpng-dev libonig-dev libxml2-dev\n\
    RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd\n\
    COPY --from=composer:latest /usr/bin/composer /usr/bin/composer\n\
    WORKDIR /app\n\
    COPY . .\n\
    RUN composer install\n\
    CMD php artisan serve --host=0.0.0.0 --port=8181\n\
    ' > /home/coder/project-laravel/Dockerfile

# Ajuster les permissions pour le nouveau fichier
RUN chown coder:coder /home/coder/project-laravel/Dockerfile

USER coder

EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/home/coder/project-laravel"]
