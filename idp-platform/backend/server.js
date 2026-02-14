const express = require('express');
const cors = require('cors');
const { exec } = require("child_process");
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
});

app.get('/api/status', (req, res) => {
    res.json({ message: "Backend is connected 🚀" });
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(5000, () => {
    console.log('Server running on port 5000');
});


app.post("/api/services", (req, res) => {
    const { name, port, template, socketId } = req.body || {};

    if (!name || !port) {
        return res.status(400).json({ error: "Name and port are required" });
    }

    // Generic Docker image map for simple services
    const simpleImageMap = {
        nginx: "nginx"
    };

    // Check if it's a dev environment template that needs building
    if (template === "node" || template === "laravel") {
        const templateFolder = template === "node" ? "node-dev" : "laravel-dev";
        const templatePath = `./templates/${templateFolder}`;
        const imageName = `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-image`;

        // Estimation du temps (en secondes)
        const estimatedBuildTime = template === "laravel" ? 180 : 120; // Laravel: 3min, Node: 2min
        const startTime = Date.now();

        // Envoyer la progression via Socket.IO
        const socket = socketId ? io.to(socketId) : null;

        if (socket) {
            socket.emit('build-progress', {
                stage: 'starting',
                progress: 0,
                message: 'Starting Docker build...',
                estimatedTimeLeft: estimatedBuildTime
            });
        }

        // Utiliser spawn pour capturer la sortie en temps réel
        const { spawn } = require('child_process');
        const buildProcess = spawn('docker', ['build', '-t', imageName, templatePath]);

        let buildOutput = '';
        let currentStep = 0;
        const totalSteps = template === "laravel" ? 10 : 8; // Estimation des étapes

        buildProcess.stdout.on('data', (data) => {
            buildOutput += data.toString();
            const output = data.toString();

            // Détecter les étapes du build
            if (output.includes('Step ')) {
                currentStep++;
                const progress = Math.min(Math.round((currentStep / totalSteps) * 90), 90); // Max 90% pour le build
                const elapsed = (Date.now() - startTime) / 1000;
                const estimatedTotal = (elapsed / progress) * 100;
                const timeLeft = Math.max(0, Math.round(estimatedTotal - elapsed));

                if (socket) {
                    socket.emit('build-progress', {
                        stage: 'building',
                        progress,
                        message: `Building image... Step ${currentStep}/${totalSteps}`,
                        estimatedTimeLeft: timeLeft
                    });
                }
            }
        });

        buildProcess.stderr.on('data', (data) => {
            buildOutput += data.toString();
        });

        buildProcess.on('close', (code) => {
            if (code !== 0) {
                console.error("Build Error:", buildOutput);
                if (socket) {
                    socket.emit('build-progress', {
                        stage: 'error',
                        progress: 0,
                        message: 'Build failed',
                        error: buildOutput
                    });
                }
                return res.status(500).json({ error: `Failed to build image: ${buildOutput}` });
            }

            console.log("Build successful");

            if (socket) {
                socket.emit('build-progress', {
                    stage: 'running',
                    progress: 95,
                    message: 'Starting container...',
                    estimatedTimeLeft: 5
                });
            }

            // Then run the container with Docker socket mounted (DooD capability)
            const runCommand = `docker run -d -p ${port}:8080 -v /var/run/docker.sock:/var/run/docker.sock --name "${name}" --label managed_by=idp "${imageName}"`;

            exec(runCommand, (runError, runStdout, runStderr) => {
                if (runError) {
                    console.error("Run Error:", runStderr);
                    let userMessage = "Failed to start container.";
                    if (runStderr.includes("port is already allocated")) {
                        userMessage = `Port ${port} is already in use.`;
                    } else if (runStderr.includes("is already in use by container")) {
                        userMessage = `Service name "${name}" is already taken.`;
                    } else {
                        userMessage = runStderr;
                    }

                    if (socket) {
                        socket.emit('build-progress', {
                            stage: 'error',
                            progress: 0,
                            message: userMessage
                        });
                    }

                    return res.status(400).json({ error: userMessage });
                }

                if (socket) {
                    socket.emit('build-progress', {
                        stage: 'complete',
                        progress: 100,
                        message: 'Dev environment ready! 🚀',
                        estimatedTimeLeft: 0
                    });
                }

                res.json({
                    message: "Dev environment ready 🚀",
                    containerId: runStdout.trim(),
                    url: `http://localhost:${port}`
                });
            });
        });

    } else {
        // Fallback for simple images (like nginx)
        const image = simpleImageMap[template] || "nginx";

        // Simple run command
        const command = `docker run -d -p ${port}:80 --name ${name} --label managed_by=idp ${image}`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("Docker Error:", stderr);
                let userMessage = "Failed to create service.";
                if (stderr.includes("port is already allocated")) {
                    userMessage = `Port ${port} is already in use.`;
                } else if (stderr.includes("is already in use by container")) {
                    userMessage = `Service name "${name}" is already taken.`;
                }
                return res.status(400).json({ error: userMessage });
            }

            res.json({
                message: "Service created successfully 🎉",
                containerId: stdout.trim()
            });
        });
    }
});

app.get("/api/services", (req, res) => {
    // Liste uniquement les containers créés par ton IDP
    // Use a custom delimiter to avoid issues with spaces
    // Important: On Windows, use single quotes around the format string if possible, or escape double quotes carefully.
    // Here we use a safe character sequence as delimiter.
    const command = 'docker ps --filter "label=managed_by=idp" --format "{{.ID}}|||{{.Names}}|||{{.Ports}}"';

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error("Docker PS Error:", error);
            console.error("Stderr:", stderr);
            return res.status(500).json({ error: stderr || "Failed to list containers" });
        }

        // Transforme stdout en tableau
        const containers = stdout
            .split("\n")
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split("|||");
                if (parts.length < 3) return null;
                const [id, name, port] = parts;
                return { id, name, port };
            })
            .filter(c => c !== null);

        res.json({ containers });
    });
});

app.delete("/api/services/:id", (req, res) => {
    const containerId = req.params.id;

    const command = `docker rm -f ${containerId}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr });
        }

        res.json({ message: "Service deleted", containerId });
    });
});



