-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quotationStatus" TEXT,
    "invoiceStatus" TEXT,
    "receiptStatus" TEXT,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "tax" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "customerId" TEXT NOT NULL,
    "ownerId" TEXT,
    "sourceDocumentId" TEXT,
    "companyId" INTEGER NOT NULL DEFAULT 1,
    "sequenceYear" INTEGER NOT NULL,
    "sequenceValue" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanySettings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentNumberSequence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentNumberSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanySettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "taxInformation" TEXT,
    CONSTRAINT "CompanyProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanySettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Branding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "logoMediaId" TEXT,
    "watermarkMediaId" TEXT,
    CONSTRAINT "Branding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanySettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Branding_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Branding_watermarkMediaId_fkey" FOREIGN KEY ("watermarkMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "quotePrefix" TEXT NOT NULL DEFAULT 'QUO',
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "receiptPrefix" TEXT NOT NULL DEFAULT 'REC',
    "defaultTaxRate" REAL NOT NULL DEFAULT 0,
    "quoteValidityDays" INTEGER NOT NULL DEFAULT 30,
    "terms" TEXT,
    "footer" TEXT,
    CONSTRAINT "DocumentSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanySettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebsiteAppearance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyId" INTEGER NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#202A27',
    "secondaryColor" TEXT NOT NULL DEFAULT '#D7F36A',
    "backgroundColor" TEXT NOT NULL DEFAULT '#F6F5F0',
    "backgroundMediaId" TEXT,
    "slideshowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overlayColor" TEXT,
    "overlayOpacity" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "WebsiteAppearance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CompanySettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebsiteAppearance_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "Media" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "title" TEXT,
    "description" TEXT,
    "altText" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "collection" TEXT NOT NULL DEFAULT 'GENERAL',
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customerId" TEXT,
    "documentId" TEXT,
    "companySettingsId" INTEGER,
    "websiteAppearanceId" INTEGER,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Media_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Media_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Media_companySettingsId_fkey" FOREIGN KEY ("companySettingsId") REFERENCES "CompanySettings" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Media_websiteAppearanceId_fkey" FOREIGN KEY ("websiteAppearanceId") REFERENCES "WebsiteAppearance" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EtimsTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "externalIdentifier" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "submissionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "responseCode" TEXT,
    "responseMessage" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "failureReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" DATETIME,
    "acceptedAt" DATETIME,
    "lastAttemptAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptId" TEXT NOT NULL,
    CONSTRAINT "EtimsTransaction_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Document_number_key" ON "Document"("number");

-- CreateIndex
CREATE INDEX "Document_customerId_idx" ON "Document"("customerId");

-- CreateIndex
CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");

-- CreateIndex
CREATE INDEX "Document_sourceDocumentId_idx" ON "Document"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Document_companyId_type_sequenceYear_sequenceValue_key" ON "Document"("companyId", "type", "sequenceYear", "sequenceValue");

-- CreateIndex
CREATE INDEX "DocumentItem_documentId_idx" ON "DocumentItem"("documentId");

-- CreateIndex
CREATE INDEX "DocumentItem_documentId_sortOrder_idx" ON "DocumentItem"("documentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptId_key" ON "Payment"("receiptId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_documentId_idx" ON "Payment"("documentId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentNumberSequence_companyId_type_year_key" ON "DocumentNumberSequence"("companyId", "type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyProfile_companyId_key" ON "CompanyProfile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Branding_companyId_key" ON "Branding"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Branding_logoMediaId_key" ON "Branding"("logoMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Branding_watermarkMediaId_key" ON "Branding"("watermarkMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSettings_companyId_key" ON "DocumentSettings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAppearance_companyId_key" ON "WebsiteAppearance"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteAppearance_backgroundMediaId_key" ON "WebsiteAppearance"("backgroundMediaId");

-- CreateIndex
CREATE INDEX "Media_customerId_idx" ON "Media"("customerId");

-- CreateIndex
CREATE INDEX "Media_documentId_idx" ON "Media"("documentId");

-- CreateIndex
CREATE INDEX "Media_companySettingsId_idx" ON "Media"("companySettingsId");

-- CreateIndex
CREATE INDEX "Media_websiteAppearanceId_idx" ON "Media"("websiteAppearanceId");

-- CreateIndex
CREATE INDEX "Media_collection_idx" ON "Media"("collection");

-- CreateIndex
CREATE INDEX "EtimsTransaction_submissionStatus_idx" ON "EtimsTransaction"("submissionStatus");

-- CreateIndex
CREATE INDEX "EtimsTransaction_invoiceNumber_idx" ON "EtimsTransaction"("invoiceNumber");

-- CreateIndex
CREATE INDEX "EtimsTransaction_receiptId_idx" ON "EtimsTransaction"("receiptId");
