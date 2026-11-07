// Carrega o arquivo .env da raiz do projeto (se existir) antes de qualquer outro módulo ler process.env.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
