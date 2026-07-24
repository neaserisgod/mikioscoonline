-- CreateTable
CREATE TABLE "RecuentoPendiente" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cantidadContada" INTEGER NOT NULL,
    "nota" TEXT,
    "creadoPorUserId" TEXT,
    "creadoEnEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoEnEl" TIMESTAMP(3),

    CONSTRAINT "RecuentoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecuentoPendiente_organizationId_aplicadoEnEl_idx" ON "RecuentoPendiente"("organizationId", "aplicadoEnEl");
