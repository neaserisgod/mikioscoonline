-- CreateTable
CREATE TABLE "OrdenMpPendiente" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "medioPagoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "montoCentavos" INTEGER NOT NULL,
    "descuentoCentavos" INTEGER NOT NULL DEFAULT 0,
    "tipo" TEXT NOT NULL,
    "lineas" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenMpPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdenMpPendiente_orderId_key" ON "OrdenMpPendiente"("orderId");

-- AddForeignKey
ALTER TABLE "OrdenMpPendiente" ADD CONSTRAINT "OrdenMpPendiente_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenMpPendiente" ADD CONSTRAINT "OrdenMpPendiente_medioPagoId_fkey" FOREIGN KEY ("medioPagoId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenMpPendiente" ADD CONSTRAINT "OrdenMpPendiente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
