-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "facturarAutomaticamente" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Comprobante" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "numero" INTEGER,
    "cae" TEXT,
    "caeFechaVencimiento" TIMESTAMP(3),
    "estado" TEXT NOT NULL,
    "error" TEXT,
    "cuitCliente" TEXT,
    "razonSocialCliente" TEXT NOT NULL,
    "condicionIVACliente" TEXT NOT NULL,
    "subtotalCentavos" INTEGER NOT NULL,
    "ivaTotalCentavos" INTEGER NOT NULL,
    "totalCentavos" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Comprobante_saleId_key" ON "Comprobante"("saleId");

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
