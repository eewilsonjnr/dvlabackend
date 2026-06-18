-- CreateEnum
CREATE TYPE "OfficeType" AS ENUM ('HEAD_OFFICE', 'REGIONAL_CENTRE', 'DISTRICT_OFFICE');

-- CreateTable
CREATE TABLE "DvlaOffice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OfficeType" NOT NULL,
    "regionName" TEXT,
    "town" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "placeOfIssueLabel" TEXT,
    "printerName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentOfficeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DvlaOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "notificationEmail" TEXT,
    "dvlaRole" TEXT NOT NULL DEFAULT 'Operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailOtpCode" TEXT,
    "emailOtpExpiresAt" TIMESTAMP(3),
    "officeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "otherNames" TEXT NOT NULL,
    "placeOfBirth" TEXT,
    "dateOfBirth" TEXT,
    "homeAddress" TEXT,
    "signatureUrl" TEXT,
    "nationalId" TEXT,
    "licenceNumber" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "permitType" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "operatorId" TEXT,
    "officeId" TEXT,
    "rejectionReason" TEXT,
    "placeOfIssue" TEXT,
    "dateOfIssue" TEXT,
    "dateOfExpiry" TEXT,
    "classOfLicence" TEXT,
    "certificateOfCompetence" TEXT,
    "ownerSurname" TEXT,
    "ownerOtherNames" TEXT,
    "ownerHomeAddress" TEXT,
    "classOfVehicle" TEXT,
    "makerOfChassis" TEXT,
    "typeOfChassis" TEXT,
    "serialNumber" TEXT,
    "numberOfCylinders" TEXT,
    "engineNumber" TEXT,
    "stroke" TEXT,
    "bore" TEXT,
    "horsePower" TEXT,
    "bodyShape" TEXT,
    "bodyColour" TEXT,
    "numberOfSeats" TEXT,
    "weightUnladen" TEXT,
    "weightLaden" TEXT,
    "identificationMark" TEXT,
    "mrzLine1" TEXT,
    "mrzLine2" TEXT,
    "bookletNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "printerName" TEXT,
    "isReprint" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfidEncoding" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "printJobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "chipSerialNumber" TEXT,
    "verificationResult" TEXT NOT NULL DEFAULT 'not_verified',
    "verificationDetails" TEXT,
    "encodedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfidEncoding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcResult" (
    "id" TEXT NOT NULL,
    "permitId" TEXT NOT NULL,
    "printJobId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "opticalInspectionScore" DOUBLE PRECISION,
    "photoQualityScore" DOUBLE PRECISION,
    "mrzValidation" BOOLEAN NOT NULL DEFAULT false,
    "rfidValidation" BOOLEAN NOT NULL DEFAULT false,
    "inspectedById" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operatorName" TEXT,
    "applicantRef" TEXT,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "details" TEXT,
    "ipAddress" TEXT,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "DvlaOffice_type_isActive_idx" ON "DvlaOffice"("type", "isActive");

-- CreateIndex
CREATE INDEX "DvlaOffice_parentOfficeId_idx" ON "DvlaOffice"("parentOfficeId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_nationalId_key" ON "Applicant"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_licenceNumber_key" ON "Applicant"("licenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Permit_referenceNumber_key" ON "Permit"("referenceNumber");

-- CreateIndex
CREATE INDEX "Permit_status_createdAt_idx" ON "Permit"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Permit_permitType_status_idx" ON "Permit"("permitType", "status");

-- CreateIndex
CREATE INDEX "PrintJob_status_createdAt_idx" ON "PrintJob"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RfidEncoding_printJobId_key" ON "RfidEncoding"("printJobId");

-- CreateIndex
CREATE INDEX "RfidEncoding_status_createdAt_idx" ON "RfidEncoding"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QcResult_printJobId_key" ON "QcResult"("printJobId");

-- CreateIndex
CREATE INDEX "QcResult_result_createdAt_idx" ON "QcResult"("result", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "DvlaOffice" ADD CONSTRAINT "DvlaOffice_parentOfficeId_fkey" FOREIGN KEY ("parentOfficeId") REFERENCES "DvlaOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "DvlaOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "DvlaOffice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidEncoding" ADD CONSTRAINT "RfidEncoding_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidEncoding" ADD CONSTRAINT "RfidEncoding_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcResult" ADD CONSTRAINT "QcResult_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcResult" ADD CONSTRAINT "QcResult_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
