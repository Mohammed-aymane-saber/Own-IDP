import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

function App() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [vscodePort, setVscodePort] = useState("");
  const [previewPort, setPreviewPort] = useState("");
  const [template, setTemplate] = useState("node");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildMessage, setBuildMessage] = useState("");
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(0);

  const socketRef = useRef(null);

  // Auto-fill preview port based on template
  useEffect(() => {
    if (template === "node") setPreviewPort("3000");
    else if (template === "laravel") setPreviewPort("8000");
    else setPreviewPort("");
  }, [template]);

  const fetchServices = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/services");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error(err);
      setProjects([]);
    }
  };

  useEffect(() => {
    fetchServices();
    socketRef.current = io("http://localhost:5000");

    socketRef.current.on('build-progress', (data) => {
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
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const handleCreate = async () => {
    if (!name || !vscodePort || !previewPort) {
      setMessage("Name, VS Code Port, and Preview Port required ❌");
      return;
    }

    setLoading(true);
    setMessage("");
    setBuildProgress(0);
    setBuildMessage("Initializing workspace...");

    try {
      const res = await fetch("http://localhost:5000/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          port: Number(vscodePort),
          previewPort: Number(previewPort),
          template,
          socketId: socketRef.current?.id
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Error creating workspace ❌");
        setLoading(false);
      } else {
        setMessage(`✅ Workspace creation started!`);
        setName("");
        setVscodePort("");
      }
    } catch (err) {
      console.error(err);
      setMessage("Error creating service ❌");
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:5000/api/services/${id}`, { method: "DELETE" });
      fetchServices();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "'Inter', sans-serif", maxWidth: "1100px", margin: "0 auto", backgroundColor: "#fcfcfc", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        .card { transition: transform 0.2s, box-shadow 0.2s; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.08) !important; }
        button:hover { opacity: 0.9; transform: scale(1.01); }
        button:active { transform: scale(0.98); }
        input, select { transition: border-color 0.2s; }
        input:focus, select:focus { border-color: #4CAF50 !important; outline: none; }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: "50px" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#1a1a1a", marginBottom: "10px" }}>
          🚀 IDP <span style={{ color: "#4CAF50" }}>Workspace</span> Center
        </h1>
        <p style={{ color: "#666", fontSize: "1.1rem" }}>Provision containers, code in VS Code, and preview live.</p>
      </div>

      <div style={{
        marginBottom: "50px",
        padding: "30px",
        borderRadius: "20px",
        backgroundColor: "#fff",
        boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
        border: "1px solid #eee"
      }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "25px", color: "#333", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ backgroundColor: "#e8f5e9", padding: "8px", borderRadius: "10px" }}>🧱</span> New Development Workspace
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#888", marginBottom: "8px", textTransform: "uppercase" }}>Project Name</label>
            <input
              type="text"
              placeholder="my-cool-app"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "1rem" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#888", marginBottom: "8px", textTransform: "uppercase" }}>VS Code Port</label>
            <input
              type="number"
              placeholder="8081"
              value={vscodePort}
              onChange={(e) => setVscodePort(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "1rem" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#888", marginBottom: "8px", textTransform: "uppercase" }}>Preview Port</label>
            <input
              type="number"
              placeholder="3001"
              value={previewPort}
              onChange={(e) => setPreviewPort(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "1rem" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "600", color: "#888", marginBottom: "8px", textTransform: "uppercase" }}>Environment</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "2px solid #f0f0f0", fontSize: "1rem", backgroundColor: "#fff" }}
            >
              <option value="node">Node.js ES6</option>
              <option value="laravel">Laravel 11 / PHP</option>
              <option value="nginx">Simple Nginx</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading}
          style={{
            marginTop: "30px",
            width: "100%",
            padding: "15px",
            backgroundColor: loading ? "#ddd" : "#4CAF50",
            color: "#fff",
            border: "none",
            borderRadius: "12px",
            fontSize: "1.1rem",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: "0 4px 10px rgba(76, 175, 80, 0.2)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px"
          }}
        >
          {loading ? "⏳ Setting up..." : <span>✨ Deploy Development Environment</span>}
        </button>

        {loading && buildProgress > 0 && (
          <div style={{ marginTop: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ fontWeight: "600", color: "#4CAF50" }}>{buildMessage}</span>
              <span style={{ fontWeight: "700" }}>{buildProgress}%</span>
            </div>
            <div style={{ width: "100%", height: "8px", backgroundColor: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ width: `${buildProgress}%`, height: "100%", backgroundColor: "#4CAF50", transition: "width 0.4s ease-out" }} />
            </div>
          </div>
        )}

        {message && (
          <div style={{
            marginTop: "20px",
            padding: "12px",
            borderRadius: "10px",
            backgroundColor: message.includes("❌") ? "#ffebee" : "#e8f5e9",
            color: message.includes("❌") ? "#c62828" : "#2e7d32",
            textAlign: "center",
            fontWeight: "600"
          }}>
            {message}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#333", marginBottom: "30px", paddingLeft: "10px", borderLeft: "6px solid #4CAF50" }}>
        Active Workspaces
      </h2>

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", backgroundColor: "#fff", borderRadius: "20px", border: "2px dashed #eee" }}>
          <p style={{ color: "#aaa", fontSize: "1.2rem" }}>No active workspaces. Launch one to get started!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "25px" }}>
          {projects.map((p) => (
            <div key={p.name} className="card" style={{
              padding: "25px",
              borderRadius: "20px",
              backgroundColor: "#fff",
              border: "1px solid #f0f0f0",
              boxShadow: "0 4px 10px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: "700", color: "#1a1a1a", display: "flex", alignItems: "center", gap: "10px" }}>
                    {p.template === "node" ? "🟢" : p.template === "laravel" ? "🔵" : "📦"} {p.name.toUpperCase()}
                  </h3>
                  <span style={{ fontSize: "0.85rem", color: "#999", fontWeight: "600", textTransform: "uppercase", marginTop: "5px", display: "block" }}>{p.template} ENVIRONMENT</span>
                </div>
                <button
                  onClick={() => p.workspace && handleDelete(p.workspace.id)}
                  style={{ background: "#fff5f5", color: "#ff5252", border: "1px solid #ffd5d5", padding: "8px 15px", borderRadius: "10px", cursor: "pointer", fontWeight: "600" }}
                >
                  Terminate
                </button>
              </div>

              {p.workspace ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                  <div style={{ padding: "15px", borderRadius: "15px", backgroundColor: "#f3f0ff", border: "1px solid #e0d9ff" }}>
                    <div style={{ fontSize: "1.2rem", marginBottom: "10px" }}>🛠️</div>
                    <div style={{ fontWeight: "700", color: "#5c4dcc", fontSize: "0.9rem" }}>VS CODE</div>
                    <div style={{ fontSize: "0.8rem", color: "#7a6db3", marginBottom: "12px" }}>Port {p.workspace.port.match(/0\.0\.0\.0:(\d+)->/)?.[1] || p.workspace.port}</div>
                    <a
                      href={`http://localhost:${p.workspace.port.match(/0\.0\.0\.0:(\d+)->/)?.[1] || p.workspace.port}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "block", textAlign: "center", padding: "10px", backgroundColor: "#5c4dcc", color: "#fff", textDecoration: "none", borderRadius: "8px", fontWeight: "600", fontSize: "0.9rem" }}
                    >
                      Open IDE
                    </a>
                  </div>

                  <div style={{ padding: "15px", borderRadius: "15px", backgroundColor: "#e8f5e9", border: "1px solid #c8e6c9" }}>
                    <div style={{ fontSize: "1.2rem", marginBottom: "10px" }}>👁️</div>
                    <div style={{ fontWeight: "700", color: "#2e7d32", fontSize: "0.9rem" }}>LIVE PREVIEW (Locally)</div>
                    <div style={{ fontSize: "0.8rem", color: "#66bb6a", marginBottom: "12px" }}>Port {p.workspace.previewPort}</div>
                    <a
                      href={`http://localhost:${p.workspace.port}/proxy/${p.workspace.previewPort}/`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "block", textAlign: "center", padding: "10px", backgroundColor: "#2e7d32", color: "#fff", textDecoration: "none", borderRadius: "8px", fontWeight: "600", fontSize: "0.9rem" }}
                    >
                      Open App
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "20px", textAlign: "center", color: "#ccc", border: "2px dashed #f0f0f0", borderRadius: "15px" }}>
                  Workspace initializing...
                </div>
              )}

              
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
