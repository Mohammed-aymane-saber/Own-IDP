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
    const { name, port, previewPort, template, socketId } = req.body || {};

    if (!name || !port || !previewPort) {
        return res.status(400).json({ error: "Name, Port, and Preview Port are required" });
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

            const runCommand = `docker run -d -p ${port}:8080 -p ${previewPort}:${previewPort} -e PREVIEW_PORT=${previewPort} -e PROJECT_TYPE=${template} -v workspace-${name}:/home/coder/project -v /var/run/docker.sock:/var/run/docker.sock --name "${name}-workspace" --label managed_by=idp --label idp_type=workspace --label idp_template=${template} --label idp_preview_port=${previewPort} "${imageName}"`;

            // Clean up existing container if any before running
            exec(`docker rm -f "${name}-workspace"`, () => {
                exec(runCommand, (runError, runStdout, runStderr) => {
                    if (runError) {
                        console.error("Run Error:", runStderr);
                        let userMessage = runStderr.includes("port is already allocated") ? `Port ${port} or ${previewPort} is already in use.` :
                            runStderr.includes("is already in use by container") ? `Service name "${name}" is already taken.` : runStderr;

                        if (socket) socket.emit('build-progress', { stage: 'error', progress: 0, message: userMessage });
                        return res.status(400).json({ error: userMessage });
                    }

                    if (socket) socket.emit('build-progress', { stage: 'complete', progress: 100, message: 'Dev environment ready! 🚀', estimatedTimeLeft: 0 });
                    res.json({ message: "Dev environment ready 🚀", containerId: runStdout.trim(), url: `http://localhost:${port}` });
                });
            });
        });

    } else {
        // Fallback for simple images (like nginx)
        const image = simpleImageMap[template] || "nginx";

        // Simple run command
        const command = `docker run -d -p ${port}:80 --name ${name} --label managed_by=idp --label idp_type=simple ${image}`;

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

// NEW: Endpoint to deploy from workspace to runtime
app.post("/api/services/:name/deploy", (req, res) => {
    const { name } = req.params;
    const { port, template, socketId } = req.body;

    if (!port || !template) {
        return res.status(400).json({ error: "Port and template are required" });
    }

    const socket = socketId ? io.to(socketId) : null;
    const runtimeName = `${name}-runtime`;
    const imageName = `${name}-prod-image`;
    const volumeName = `workspace-${name}`;
    const templatePath = `./templates/${template}-prod`;

    if (socket) {
        socket.emit('build-progress', {
            stage: 'starting',
            progress: 0,
            message: 'Starting Production build...',
            estimatedTimeLeft: 60
        });
    }

    // Important: We need to build from the volume content.
    // Instead of direct file access (which fails on Windows Host), 
    // we use a docker build from stdin with a tar context generated from the volume.
    // We also need to inject the prod Dockerfile into that context.

    // 1. Prepare the command to build the image from volume + template Dockerfile
    // On Windows, piping works in PowerShell/CMD but we must be careful with quotes.
    // We use a helper container to tar the volume and merge it with the Dockerfile.

    // Simpler approach for local: 
    // docker run --rm -v ${volumeName}:/src -v ./templates/${template}-prod:/template alpine sh -c "cp /template/Dockerfile /src/ && tar -C /src -cf - ." | docker build -t ${imageName} -

    const buildCommand = `docker run --rm -v ${volumeName}:/src -v "${process.cwd()}/templates/${template}-prod":/template alpine sh -c "cp /template/Dockerfile /src/ && tar -C /src -cf - ." | docker build -t ${imageName} -`;

    console.log("Running build command:", buildCommand);

    if (socket) {
        socket.emit('build-progress', {
            stage: 'building',
            progress: 30,
            message: 'Building production image from workspace...',
            estimatedTimeLeft: 40
        });
    }

    exec(buildCommand, (buildError, buildStdout, buildStderr) => {
        if (buildError) {
            console.error("Build Error:", buildStderr || buildStdout);
            if (socket) {
                socket.emit('build-progress', {
                    stage: 'error',
                    progress: 0,
                    message: 'Production build failed',
                    error: buildStderr || buildStdout
                });
            }
            return res.status(500).json({ error: `Failed to build production image: ${buildStderr || buildStdout}` });
        }

        if (socket) {
            socket.emit('build-progress', {
                stage: 'running',
                progress: 80,
                message: 'Starting runtime container...',
                estimatedTimeLeft: 10
            });
        }

        // 2. Stop and remove existing runtime if any
        const stopCommand = `docker stop ${runtimeName} && docker rm ${runtimeName}`;
        exec(stopCommand, () => {
            // 3. Run the runtime container
            // Note: Node prod uses 3000, Laravel prod uses 8000.
            const internalPort = template === "node" ? 3000 : 8000;
            const runCommand = `docker run -d -p ${port}:${internalPort} --name "${runtimeName}" --label managed_by=idp --label idp_type=runtime --label idp_project=${name} "${imageName}"`;

            exec(runCommand, (runError, runStdout, runStderr) => {
                if (runError) {
                    console.error("Run Error:", runStderr);
                    if (socket) {
                        socket.emit('build-progress', { stage: 'error', progress: 0, message: runStderr });
                    }
                    return res.status(400).json({ error: runStderr });
                }

                if (socket) {
                    socket.emit('build-progress', {
                        stage: 'complete',
                        progress: 100,
                        message: 'Production runtime ready! 🚀',
                        estimatedTimeLeft: 0
                    });
                }

                res.json({
                    message: "Production runtime ready 🚀",
                    containerId: runStdout.trim(),
                    url: `http://localhost:${port}`
                });
            });
        });
    });
});

app.get("/api/services", (req, res) => {
    // Liste uniquement les containers créés par ton IDP
    // We include labels to distinguish between workspace and runtime
    const command = 'docker ps -a --filter "label=managed_by=idp" --format "{{.ID}}|||{{.Names}}|||{{.Ports}}|||{{.Labels}}"';

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error("Docker PS Error:", error);
            return res.status(500).json({ error: "Failed to list containers" });
        }

        const containers = stdout
            .split("\n")
            .filter(line => line.trim())
            .map(line => {
                const parts = line.split("|||");
                if (parts.length < 4) return null;
                const [id, name, portStr, labelsStr] = parts;

                // Parse labels
                const labels = {};
                labelsStr.split(",").forEach(l => {
                    const [k, v] = l.split("=");
                    if (k && v) labels[k] = v;
                });

                // Robust port parsing
                // Example: 0.0.0.0:8081->8080/tcp, 0.0.0.0:3001->3000/tcp
                let vscodePort = null;
                const portMappings = portStr.split(",").map(p => p.trim());
                const vscodeMapping = portMappings.find(pm => pm.endsWith("->8080/tcp"));
                if (vscodeMapping) {
                    const match = vscodeMapping.match(/:(\d+)->/);
                    if (match) vscodePort = match[1];
                }

                return {
                    id,
                    name,
                    port: vscodePort || portStr,
                    type: labels.idp_type || 'simple',
                    template: labels.idp_template || 'unknown',
                    previewPort: labels.idp_preview_port || null,
                    project: name.replace('-workspace', '')
                };
            })
            .filter(c => c !== null);

        // Group by project
        const projectsMap = {};
        containers.forEach(c => {
            const pName = c.project;
            if (!projectsMap[pName]) {
                projectsMap[pName] = {
                    name: pName,
                    template: c.template,
                    workspace: null,
                    services: []
                };
            }

            if (c.type === 'workspace') {
                projectsMap[pName].workspace = c;
            } else {
                projectsMap[pName].services.push(c);
            }
        });

        res.json({ projects: Object.values(projectsMap) });
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



