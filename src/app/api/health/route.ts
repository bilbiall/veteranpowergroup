import { apiSuccess, withApiErrorHandling } from "@/lib/http";

export const GET = withApiErrorHandling(async () => {
  return apiSuccess({ status: "ok" });
});
