-- CreateTable
CREATE TABLE "leave_documents" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_documents_organisationId_idx" ON "leave_documents"("organisationId");

-- CreateIndex
CREATE INDEX "leave_documents_leaveRequestId_idx" ON "leave_documents"("leaveRequestId");

-- CreateIndex
CREATE INDEX "leave_documents_employeeId_idx" ON "leave_documents"("employeeId");

-- AddForeignKey
ALTER TABLE "leave_documents" ADD CONSTRAINT "leave_documents_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_documents" ADD CONSTRAINT "leave_documents_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_documents" ADD CONSTRAINT "leave_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
