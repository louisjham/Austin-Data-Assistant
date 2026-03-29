import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy Route
  app.get("/api/proxy-csv", async (req, res) => {
    const { id, limit } = req.query;
    if (!id) {
      return res.status(400).json({ error: "Missing dataset ID" });
    }
    const url = `https://data.austintexas.gov/resource/${id}.csv?$limit=${limit || 1000}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Austin Data: ${response.statusText}`);
      }
      const data = await response.text();
      res.setHeader('Content-Type', 'text/csv');
      res.send(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Failed to fetch data from proxy" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
