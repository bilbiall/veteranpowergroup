import { apiSuccess, withApiErrorHandling } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const GET = withApiErrorHandling(async () => {
  await prisma.$queryRaw`SELECT 1`;
  return apiSuccess({ status: "ok", database: "connected" });
});
