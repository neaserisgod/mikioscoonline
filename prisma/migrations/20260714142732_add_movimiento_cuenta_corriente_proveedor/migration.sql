-- CreateTable
CREATE TABLE "MovimientoCuentaCorrienteProveedor" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "montoCentavos" INTEGER NOT NULL,
    "cajaId" TEXT,
    "nota" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCuentaCorrienteProveedor_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MovimientoCuentaCorrienteProveedor" ADD CONSTRAINT "MovimientoCuentaCorrienteProveedor_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaCorrienteProveedor" ADD CONSTRAINT "MovimientoCuentaCorrienteProveedor_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuentaCorrienteProveedor" ADD CONSTRAINT "MovimientoCuentaCorrienteProveedor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
