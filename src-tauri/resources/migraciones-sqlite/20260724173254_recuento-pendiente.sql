-- CreateTable
CREATE TABLE "RecuentoPendiente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cantidadContada" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoPorUserId" TEXT,
    "creadoEnEl" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoEnEl" DATETIME
);

-- CreateIndex
CREATE INDEX "RecuentoPendiente_organizationId_aplicadoEnEl_idx" ON "RecuentoPendiente"("organizationId", "aplicadoEnEl");

