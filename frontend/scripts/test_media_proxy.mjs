import assert from "node:assert/strict";
import http from "node:http";

import { fetchMedia, mediaUpstream, redirectStaysOnMedia } from "../lib/mediaProxy.ts";

const origin = "http://127.0.0.1:9";
const ok = mediaUpstream(origin, ["shots", "house.png"]);
assert.equal(ok?.href, "http://127.0.0.1:9/media/shots/house.png");
assert.equal(mediaUpstream(origin, ["..", "etc", "passwd"]), null);
assert.equal(mediaUpstream(origin, ["shots", "..", "secret"]), null);
assert.equal(mediaUpstream(origin, []), null);
assert.equal(mediaUpstream(origin, ["a/b"]), null);
assert.equal(mediaUpstream("notaurl", ["a.png"]), null);
assert.equal(mediaUpstream("file:///tmp", ["a.png"]), null);
assert.equal(mediaUpstream("http://user:pass@127.0.0.1:9", ["a.png"]), null);

const base = new URL("http://127.0.0.1:9/media/shots/a.png");
assert.equal(redirectStaysOnMedia(base, "http://evil.example/media/a.png"), null);
assert.equal(redirectStaysOnMedia(base, "http://127.0.0.1:9/api/secret"), null);
assert.equal(redirectStaysOnMedia(base, "http://127.0.0.1:9/media/../secret"), null);
assert.equal(redirectStaysOnMedia(base, "/media/ok.png")?.pathname, "/media/ok.png");

function listen(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

const evilHits = [];
const evil = await listen((req, res) => {
  evilHits.push(req.url);
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("evil");
});

const goodHits = [];
const good = await listen((req, res) => {
  goodHits.push(req.url);
  if (req.url === "/media/start.png") {
    res.writeHead(302, { Location: `http://127.0.0.1:${evil.port}/media/stolen.png` });
    res.end();
    return;
  }
  if (req.url === "/media/leave.png") {
    res.writeHead(302, { Location: "/api/secret" });
    res.end();
    return;
  }
  if (req.url === "/media/hop.png") {
    res.writeHead(302, { Location: "/media/landed.png" });
    res.end();
    return;
  }
  if (req.url === "/media/landed.png") {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end("png");
    return;
  }
  res.writeHead(404);
  res.end();
});

const django = `http://127.0.0.1:${good.port}`;

const cross = await fetchMedia(django, ["start.png"], (input, init) => fetch(input, init));
assert.equal(cross.ok, false);
assert.equal(cross.status, 502);
assert.deepEqual(evilHits, []);

const escaped = await fetchMedia(django, ["leave.png"], (input, init) => fetch(input, init));
assert.equal(escaped.ok, false);
assert.equal(escaped.status, 502);
assert.equal(goodHits.includes("/api/secret"), false);

const followed = await fetchMedia(django, ["hop.png"], (input, init) => fetch(input, init));
assert.equal(followed.ok, true);
assert.equal(Buffer.from(followed.body).toString(), "png");
assert.equal(goodHits.includes("/media/landed.png"), true);

const traversal = await fetchMedia(django, ["..", "api", "secret"], (input, init) => fetch(input, init));
assert.equal(traversal.status, 400);
assert.equal(goodHits.includes("/api/secret"), false);

evil.server.close();
good.server.close();
console.log("media proxy tests passed");
