ALTER TABLE "User" ADD COLUMN "sectionAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "User"
SET "sectionAccess" = ARRAY['dashboard', 'customers', 'prospects', 'quotations', 'invoices', 'receipts', 'payment-plans', 'analytics', 'reports', 'findings', 'portfolio', 'settings']::TEXT[]
WHERE "id" IN (
  SELECT ur."userId"
  FROM "UserRole" ur
  JOIN "Role" r ON r."id" = ur."roleId"
  WHERE r."name" = 'Prototype staff'
);
