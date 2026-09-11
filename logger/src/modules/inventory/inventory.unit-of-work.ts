import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
export class InventoryUnitOfWork {
 constructor(private readonly prisma: PrismaClient) {}
 execute<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
   const run = async (attempt: number): Promise<T> => {
     try {
       return await this.prisma.$transaction((tx) => work(tx), { isolationLevel: "Serializable" });
     } catch (error) {
       const code = (error as { code?: string }).code;
       if (code === "P2034" && attempt < 3) return run(attempt + 1);
       throw error;
     }
   };
   return run(0);
 }
}