import { runMigrations } from "./client.js";

runMigrations()
  .then(() => {
    console.log("[migrate] ok");
    process.exit(0);
  })
  .catch((err) => {
    console.error("[migrate] falhou", err);
    process.exit(1);
  });
