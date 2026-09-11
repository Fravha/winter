import type { PrismaClient } from "../../generated/prisma/client.js";
export class PrismaInventoryRepository { constructor(readonly prisma: PrismaClient) {} }