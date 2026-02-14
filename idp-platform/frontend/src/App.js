import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

function App() {
  const [services, setServices] = useState([]);
  const [name, setName] = useState("");
  const [servicePort, setServicePort] = useState("");
  const [template, setTemplate] = useState("node");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildMessage, setBuildMessage] = useState("");
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(0);

  const socketRef = useRef(null);

  // Fonction pour récupérer les services
  const fetchServices = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/services");
      const data = await res.json();
      setServices(data.containers || []);
    } catch (err) {
      console.error(err);
      setServices([]); // Fallback to empty array on error
    }
  };

  useEffect(() => {
    fetchServices();

    // Connexion Socket.IO
    socketRef.current = io("http://localhost:5000");

    socketRef.current.on('connect', () => {
      console.log('Connected to server:', socketRef.current.id);
    });

    socketRef.current.on('build-progress', (data) => {
      console.log('Build progress:', data);
      setBuildProgress(data.progress);
      setBuildMessage(data.message);
      setEstimatedTimeLeft(data.estimatedTimeLeft || 0);

      if (data.stage === 'complete') {
        setTimeout(() => {
          setLoading(false);
          setBuildProgress(0);
          setBuildMessage("");
          fetchServices();
        }, 2000);
      } else if (data.stage === 'error') {
        setLoading(false);
        setBuildProgress(0);
        setMessage(data.message || data.error);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Créer un service
  const handleCreate = async () => {
    // 1. Validation Frontend
    if (!name || !servicePort) {
      setMessage("Name and port required ❌");
      return;
    }
    if (services.some(s => s.name === name)) {
      setMessage("Name already exists! ❌");
      return;
    }
    // Port validation: ensure both come as numbers or strings for comparison
    if (services.some(s => Number(s.port) === Number(servicePort))) {
      setMessage("Port already in use! ❌");
      return;
    }

    setLoading(true);
    setMessage("");
    setBuildProgress(0);
    setBuildMessage("");
    setEstimatedTimeLeft(0);

    try {
      const res = await fetch("http://localhost:5000/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          port: Number(servicePort),
          template,
          socketId: socketRef.current?.id
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const isDev = template === "node" || template === "laravel";
        setMessage(
          isDev
            ? `✅ Dev environment ready! Open: http://localhost:${servicePort}`
            : "Service created successfully ✅"
        );
        setName("");
        setServicePort("");

        // Pour les services simples, pas de progression
        if (!isDev) {
          setLoading(false);
          fetchServices();
        }
      } else {
        setMessage(data.error || "Error creating service ❌");
        setLoading(false);
        setBuildProgress(0);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error creating service ❌");
      setLoading(false);
      setBuildProgress(0);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/services/${id}`, {
        method: "DELETE",
      });
      fetchServices();
    } catch (err) {
      console.error(err);
    }
  };

  const isDevTemplate = template === "node" || template === "laravel";

  return (
    <div style={{ padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <h1>🚀 My Internal Developer Platform</h1>

      <div style={{
        marginBottom: "30px",
        padding: "20px",
        border: "2px solid #ddd",
        borderRadius: "8px",
        backgroundColor: "#f9f9f9"
      }}>
        <h2 style={{ marginTop: 0 }}>
          {isDevTemplate ? "🖥️ Create Dev Environment" : "📦 Create Simple Service"}
        </h2>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
            Template Type:
          </label>
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            style={{
              marginRight: "10px",
              padding: "8px",
              fontSize: "14px",
              borderRadius: "4px",
              border: "1px solid #ccc"
            }}
          >
            <option value="node">🟢 Node.js Dev (VS Code)</option>
            <option value="laravel">🔵 Laravel Dev (VS Code)</option>
            <option value="nginx">⚪ Nginx (Simple)</option>
          </select>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="Service Name (e.g., my-project)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              marginRight: "10px",
              padding: "8px",
              width: "200px",
              borderRadius: "4px",
              border: "1px solid #ccc"
            }}
          />
          <input
            type="number"
            placeholder="Port (e.g., 8080)"
            value={servicePort}
            onChange={(e) => setServicePort(e.target.value)}
            style={{
              marginRight: "10px",
              padding: "8px",
              width: "150px",
              borderRadius: "4px",
              border: "1px solid #ccc"
            }}
          />

          <button
            onClick={handleCreate}
            disabled={loading}
            style={{
              padding: "8px 20px",
              backgroundColor: loading ? "#ccc" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "bold"
            }}
          >
            {loading ? "⏳ Creating..." : `✨ Create ${isDevTemplate ? "Dev Environment" : "Service"}`}
          </button>
        </div>

        {isDevTemplate && (
          <p style={{
            margin: "10px 0 0 0",
            padding: "10px",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            fontSize: "13px"
          }}>
            ℹ️ This will create a VS Code environment accessible in your browser at <strong>http://localhost:{servicePort || "PORT"}</strong>
          </p>
        )}

        {/* Barre de progression pour les builds */}
        {loading && buildProgress > 0 && (
          <div style={{ marginTop: "20px" }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "bold"
            }}>
              <span style={{ color: "#2196F3" }}>
                {buildMessage || "Building..."}
              </span>
              <span style={{ color: "#666" }}>
                {buildProgress}%
              </span>
            </div>

            {/* Barre de progression */}
            <div style={{
              width: "100%",
              height: "24px",
              backgroundColor: "#e0e0e0",
              borderRadius: "12px",
              overflow: "hidden",
              position: "relative"
            }}>
              <div style={{
                width: `${buildProgress}%`,
                height: "100%",
                backgroundColor: buildProgress === 100 ? "#4CAF50" : "#2196F3",
                transition: "width 0.3s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: "10px",
                color: "white",
                fontSize: "12px",
                fontWeight: "bold"
              }}>
                {buildProgress > 10 && `${buildProgress}%`}
              </div>
            </div>

            {/* Temps restant estimé */}
            {estimatedTimeLeft > 0 && (
              <p style={{
                marginTop: "8px",
                fontSize: "13px",
                color: "#666",
                textAlign: "center"
              }}>
                ⏱️ Estimated time remaining: <strong>{Math.floor(estimatedTimeLeft / 60)}m {estimatedTimeLeft % 60}s</strong>
              </p>
            )}
          </div>
        )}

        {/* Messages de status */}
        {loading && buildProgress === 0 && <p style={{ color: "#2196F3", fontWeight: "bold" }}>⏳ Initializing...</p>}
        {message && <p style={{ marginTop: "10px", fontWeight: "bold", color: message.includes("❌") ? "#f44336" : "#4CAF50" }}>{message}</p>}
      </div>

      <h2>📋 Existing Services</h2>
      {services.length === 0 ? (
        <p style={{ color: "#999" }}>No services running yet. Create one above!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {services.map((s) => {
            // Detect if it's a dev environment (port 8080 exposed)
            const isDevEnv = s.port && s.port.includes("8080");
            const portMatch = s.port ? s.port.match(/0\.0\.0\.0:(\d+)->/) : null;
            const externalPort = portMatch ? portMatch[1] : "N/A";

            return (
              <li
                key={s.id}
                style={{
                  marginBottom: "10px",
                  padding: "15px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  backgroundColor: isDevEnv ? "#f1f8e9" : "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <strong>{isDevEnv ? "🖥️" : "📦"} {s.name}</strong>
                  <br />
                  <span style={{ fontSize: "13px", color: "#666" }}>
                    Port: {s.port || "N/A"}
                  </span>
                  {isDevEnv && externalPort !== "N/A" && (
                    <>
                      <br />
                      <a
                        href={`http://localhost:${externalPort}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "13px",
                          color: "#2196F3",
                          textDecoration: "none",
                          fontWeight: "bold"
                        }}
                      >
                        🔗 Open VS Code →
                      </a>
                    </>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(s.id)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#f44336",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "13px"
                  }}
                >
                  🗑️ Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default App;
