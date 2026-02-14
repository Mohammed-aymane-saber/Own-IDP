FROM codercom/code-server:latest

USER root

# Installer Node + Git
RUN apt-get update && \
    apt-get install -y nodejs npm git && \
    rm -rf /var/lib/apt/lists/*

# Créer dossier projet
RUN mkdir -p /home/coder/project
WORKDIR /home/coder/project

# Initialiser un projet Node.js avec Express
RUN npm init -y && \
    npm install express cors dotenv && \
    npm install --save-dev nodemon

# Créer un fichier server.js de base
RUN echo 'const express = require("express");\n\
    const app = express();\n\
    const PORT = process.env.PORT || 3000;\n\
    \n\
    app.use(express.json());\n\
    \n\
    app.get("/", (req, res) => {\n\
    res.json({ message: "Hello from Node.js! 🚀" });\n\
    });\n\
    \n\
    app.listen(PORT, () => {\n\
    console.log(`Server running on port ${PORT}`);\n\
    });' > server.js

# Créer un .gitignore
RUN echo 'node_modules/\n\
    .env\n\
    *.log' > .gitignore

# Créer un README
RUN echo '# Node.js Project\n\
    \n\
    ## Getting Started\n\
    \n\
    Run the server:\n\
    ```bash\n\
    node server.js\n\
    ```\n\
    \n\
    Or with nodemon for auto-reload:\n\
    ```bash\n\
    npx nodemon server.js\n\
    ```' > README.md

# Donner permissions
RUN chown -R coder:coder /home/coder/project

USER coder

EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none"]
