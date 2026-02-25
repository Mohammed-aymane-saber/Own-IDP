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
# Configurer VS Code pour le lancement automatique
RUN mkdir -p /home/coder/project/.vscode && \
    printf '{\n    "version": "2.0.0",\n    "tasks": [\n        {\n            "label": "Auto-Start Server",\n            "type": "shell",\n            "command": "export PORT=${env:PREVIEW_PORT} && node server.js",\n            "runOptions": { "runOn": "folderOpen" },\n            "presentation": { "reveal": "always", "panel": "new" },\n            "group": { "kind": "build", "isDefault": true }\n        }\n    ]\n}' > /home/coder/project/.vscode/tasks.json && \
    printf '{\n    "task.allowAutomaticTasks": "on",\n    "security.workspace.trust.enabled": false\n}' > /home/coder/project/.vscode/settings.json && \
    chown -R coder:coder /home/coder/project/.vscode

# Créer un README
RUN printf "# Node.js Project\n\n## Getting Started\n\nTo see your app in the Live Preview, the server starts automatically.\nIf it doesn't, run:\n\`\`\`bash\nPORT=\$PREVIEW_PORT node server.js\n\`\`\`\n" > README.md

# Donner permissions
RUN chown -R coder:coder /home/coder/project

USER coder

EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "/home/coder/project"]
