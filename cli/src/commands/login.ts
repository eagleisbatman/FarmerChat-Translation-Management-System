import open from "open";
import http from "http";
import { generateToken, verifyToken } from "../api";
import { setToken, getToken, getApiUrl } from "../config";
import chalk from "chalk";
import { URL } from "url";

export async function loginCommand(): Promise<void> {
  const existingToken = getToken();
  
  if (existingToken) {
    try {
      const result = await verifyToken();
      if (result.valid) {
        console.log(chalk.green("✓ Already logged in as"), chalk.bold(result.user.email));
        console.log(chalk.gray("Run 'linguaflow logout' to log out"));
        return;
      }
    } catch {
      // Token invalid, proceed with login
    }
  }

  console.log(chalk.blue("🔐 Initiating login..."));
  console.log(chalk.gray(`API URL: ${getApiUrl()}`));
  console.log();

  return new Promise((resolve, reject) => {
    // Start local server to receive callback
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      
      if (url.pathname === "/callback") {
        // Get token from query params or try to generate it
        const token = url.searchParams.get("token");
        
        if (token) {
          setToken(token);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #22c55e;">✓ Login Successful!</h1>
                <p>You can close this window and return to your terminal.</p>
              </body>
            </html>
          `);
          
          server.close();
          
          try {
            const result = await verifyToken();
            console.log(chalk.green("✓ Successfully logged in!"));
            console.log(chalk.gray(`Logged in as: ${result.user.email}`));
            resolve();
          } catch (error: any) {
            console.error(chalk.red("✗ Token verification failed:"), error.message);
            reject(error);
          }
        } else {
          // Try to generate token (user should be authenticated via cookies)
          try {
            const tokenData = await generateToken();
            setToken(tokenData.token);
            
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #22c55e;">✓ Login Successful!</h1>
                  <p>You can close this window and return to your terminal.</p>
                </body>
              </html>
            `);
            
            server.close();
            
            console.log(chalk.green("✓ Successfully logged in!"));
            console.log(chalk.gray(`Token expires: ${new Date(tokenData.expiresAt).toLocaleString()}`));
            console.log(chalk.gray(`Logged in as: ${tokenData.user.email}`));
            resolve();
          } catch (error: any) {
            res.writeHead(400, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                  <h1 style="color: #ef4444;">✗ Login Failed</h1>
                  <p>${error.message}</p>
                  <p>Please make sure you're logged in to LinguaFlow in your browser.</p>
                </body>
              </html>
            `);
            server.close();
            reject(error);
          }
        }
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    const port = 45678; // Default port for callback
    server.listen(port, async () => {
      const apiUrl = getApiUrl();
      const callbackUrl = `http://localhost:${port}/callback`;
      const loginUrl = `${apiUrl}/signin?callbackUrl=${encodeURIComponent(`${apiUrl}/api/cli/callback?redirect=${encodeURIComponent(callbackUrl)}`)}`;
      
      console.log(chalk.yellow("Opening browser for authentication..."));
      console.log(chalk.gray("If the browser doesn't open, visit this URL:"));
      console.log(chalk.cyan(loginUrl));
      console.log();
      console.log(chalk.gray("Waiting for authentication..."));
      
      await open(loginUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Login timeout. Please try again."));
    }, 5 * 60 * 1000);
  });
}
