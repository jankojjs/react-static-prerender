import puppeteer from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { createServer } from "http";

async function findAvailablePort(startPort = 5050) {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      await new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(port, () => {
          server.close(() => resolve(port));
        });
        server.on("error", reject);
      });
      return port;
    } catch (error) {
      continue;
    }
  }
  throw new Error("No available port found");
}

async function waitForServer(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok) return true;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(
    `Server on port ${port} did not start within ${maxAttempts} seconds`
  );
}

async function killProcessGroup(childProcess) {
  return new Promise((resolve) => {
    if (!childProcess || childProcess.killed) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      try {
        process.kill(-childProcess.pid, "SIGKILL");
      } catch (e) {}
      resolve();
    }, 2000);

    childProcess.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    childProcess.on("error", () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      process.kill(-childProcess.pid, "SIGTERM");
    } catch {
      clearTimeout(timeout);
      resolve();
    }
  });
}

export async function prerender(config) {
  const {
    routes = [],
    outDir = "static-pages",
    serveDir = "build",
    flatOutput = false,
    skipPrerenderSelector,
    viewport,
  } = config;

  const outDirPath = path.resolve(process.cwd(), outDir);
  const port = await findAvailablePort();

  let serveProcess = null;
  let browser = null;

  try {
    serveProcess = spawn(
      "npx",
      ["serve", "-s", serveDir, "-l", port.toString()],
      {
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        detached: true,
      }
    );

    serveProcess.stdout.on("data", (data) => {
      if (process.env.DEBUG) process.stdout.write(`[serve] ${data}`);
    });
    serveProcess.stderr.on("data", (data) => {
      if (process.env.DEBUG) process.stderr.write(`[serve] ${data}`);
    });

    await waitForServer(port);
    console.log(`🚀 Server started on port ${port}`);

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();

    // set viewport if defined
    if (viewport) {
      await page.setViewport(viewport);
    }

    await fs.mkdir(outDirPath, { recursive: true });

    for (const route of routes) {
      const url = `http://localhost:${port}${route}`;
      console.log(`📄 Processing route: ${route}`);

      await page.goto(url, { waitUntil: "networkidle0" });

      // remove volatile elements before capturing HTML
      if (skipPrerenderSelector) {
        await page.evaluate((selector) => {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        }, skipPrerenderSelector);
      }

      const html = await page.content();

      if (route === "/") {
        await fs.writeFile(path.join(outDirPath, "index.html"), html);
        console.log(`✅ Saved static page: index.html`);
      } else {
        const safeName = route.replace(/^\//, "").replace(/\//g, "-") || "root";

        if (flatOutput) {
          const fileName = `${safeName}.html`;
          await fs.writeFile(path.join(outDirPath, fileName), html);
          console.log(`✅ Saved static page: ${fileName}`);
        } else {
          const routeDir = path.join(outDirPath, safeName);
          await fs.mkdir(routeDir, { recursive: true });
          await fs.writeFile(path.join(routeDir, "index.html"), html);
          console.log(
            `✅ Saved static page: ${path.join(safeName, "index.html")}`
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ Prerendering failed:", error);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (serveProcess) await killProcessGroup(serveProcess);
  }
}
