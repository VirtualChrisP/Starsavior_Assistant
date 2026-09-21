import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8"
};

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/public/index.html" : url.pathname;
  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const filePath = join(root, relativePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("未找到资源");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Star Savior BP 助手已启动：http://127.0.0.1:${port}`);
});
