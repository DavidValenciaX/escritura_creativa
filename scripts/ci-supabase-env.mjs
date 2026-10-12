import { readFileSync, appendFileSync } from "node:fs";

// Recibe únicamente el estado del stack efímero arrancado por el runner.
const status = JSON.parse(readFileSync(process.argv[2], "utf8"));
const variables = {
  INTEGRATION_SUPABASE_URL: status.API_URL,
  INTEGRATION_SUPABASE_ANON_KEY: status.ANON_KEY,
  INTEGRATION_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
};

if (!process.env.GITHUB_ENV)
  throw new Error("Este script se ejecuta en GitHub Actions.");
for (const [name, value] of Object.entries(variables)) {
  if (typeof value !== "string" || !value || /[\r\n]/.test(value)) {
    throw new Error(`Supabase no devolvió una credencial válida para ${name}.`);
  }
}
for (const [name, value] of Object.entries(variables)) {
  if (name !== "INTEGRATION_SUPABASE_URL") console.log(`::add-mask::${value}`);
  appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
}
