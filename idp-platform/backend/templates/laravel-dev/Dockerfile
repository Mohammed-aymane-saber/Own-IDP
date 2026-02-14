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
RUN echo '# Laravel Project\n\
    \n\
    ## Getting Started\n\
    \n\
    This is a fresh Laravel installation ready to use!\n\
    \n\
    ### Run the development server:\n\
    ```bash\n\
    php artisan serve --host=0.0.0.0 --port=8000\n\
    ```\n\
    \n\
    ### Run migrations:\n\
    ```bash\n\
    php artisan migrate\n\
    ```\n\
    \n\
    ### Create a controller:\n\
    ```bash\n\
    php artisan make:controller MyController\n\
    ```\n\
    \n\
    Enjoy coding! 🚀' > README_LARAVEL.md

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

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none"]
