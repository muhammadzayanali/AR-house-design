/**
 * Local HTTPS front for `next start`.
 * The phone opens https://<lan-ip>:<port>. Next stays on HTTP at 127.0.0.1.
 */
import fs from "node:fs";
import http from "node:http";
import https from "node:https";

const listenHost = process.env.DEMO_HTTPS_HOST || "0.0.0.0";
const listenPort = Number(process.env.DEMO_HTTPS_PORT || "3443");
const targetHost = process.env.DEMO_HTTP_HOST || "127.0.0.1";
const targetPort = Number(process.env.DEMO_HTTP_PORT || "3010");
const key = fs.readFileSync(process.env.DEMO_TLS_KEY);
const cert = fs.readFileSync(process.env.DEMO_TLS_CERT);

const server = https.createServer({ key, cert }, (req, res) => {
  const headers = { ...req.headers, host: `${targetHost}:${targetPort}` };
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-host"] = req.headers.host || `${listenHost}:${listenPort}`;
  const upstream = http.request(
    {
      hostname: targetHost,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers,
    },
    (proxied) => {
      res.writeHead(proxied.statusCode || 502, proxied.headers);
      proxied.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("HTTPS proxy could not reach Next");
  });
  req.pipe(upstream);
});

server.listen(listenPort, listenHost, () => {
  console.log(`HTTPS proxy https://${listenHost}:${listenPort} -> http://${targetHost}:${targetPort}`);
});
