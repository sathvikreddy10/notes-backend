import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json({ limit: "2mb" })); // allow decent notes size
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  })
);

// rate limits
app.use("/ask", rateLimit({ windowMs: 60_000, max: 30 }));
app.use("/upload-notes", rateLimit({ windowMs: 60_000, max: 20 }));

// health
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", (_req, res) => res.send("API OK"));

// Q&A forwarder (existing)
app.post("/ask", async (req, res) => {
  try {
    const { username, apiKey, question } = req.body || {};
    if (!username || !apiKey || !question) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing username/apiKey/question" });
    }

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (!n8nUrl) {
      return res
        .status(500)
        .json({ ok: false, error: "N8N_WEBHOOK_URL not set" });
    }

    const r = await axios.post(
      n8nUrl,
      { username, apiKey, question },
      { headers: { "Content-Type": "application/json" }, timeout: 240_000 }
    );

    return res.status(200).json(r.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data =
      err.response?.data || { error: err.message || "Unknown error" };
    return res.status(status).json({ ok: false, ...data });
  }
});

// Notes uploader forwarder (new)
app.post("/upload-notes", async (req, res) => {
  try {
    const { username, apiKey, notes } = req.body || {};
    if (!username || !apiKey || !notes) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing username/apiKey/notes" });
    }

    const n8nNotesUrl = process.env.N8N_NOTES_WEBHOOK_URL;
    if (!n8nNotesUrl) {
      return res
        .status(500)
        .json({ ok: false, error: "N8N_NOTES_WEBHOOK_URL not set" });
    }

    const r = await axios.post(
      n8nNotesUrl,
      { username, apiKey, notes },
      { headers: { "Content-Type": "application/json" }, timeout: 240_000 }
    );

    return res.status(200).json(r.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const data =
      err.response?.data || { error: err.message || "Unknown error" };
    return res.status(status).json({ ok: false, ...data });
  }
});

const port = process.env.PORT || 9000;
const server = app.listen(port, () =>
  console.log(`API on http://localhost:${port}`)
);

// extend Node server timeouts to 4+ minutes
server.requestTimeout = 240_000; // 4 min
server.headersTimeout = 250_000; // must be > requestTimeout
server.keepAliveTimeout = 245_000;


