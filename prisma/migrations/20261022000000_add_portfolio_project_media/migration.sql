ALTER TABLE "Media" ADD COLUMN "portfolioProjectId" TEXT;

CREATE INDEX "Media_portfolioProjectId_idx" ON "Media"("portfolioProjectId");

ALTER TABLE "Media"
ADD CONSTRAINT "Media_portfolioProjectId_fkey"
FOREIGN KEY ("portfolioProjectId") REFERENCES "PortfolioProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;