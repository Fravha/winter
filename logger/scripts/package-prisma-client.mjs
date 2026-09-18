import { access, cp, rm } from "node:fs/promises";

const source = new URL("../src/generated/prisma/", import.meta.url);
const destination = new URL("../dist/generated/prisma/", import.meta.url);

await access(new URL("client.js", source));
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
await access(new URL("client.js", destination));
await access(new URL("package.json", destination));