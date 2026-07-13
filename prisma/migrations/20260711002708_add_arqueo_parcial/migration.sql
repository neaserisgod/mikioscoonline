-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "horariosArqueo" TEXT;

-- CreateTable
CREATE TABLE "ArqueoParcial" (
    "id" TEXT NOT NULL,
    "cajaSesionId" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "efectivoEsperadoCentavos" INTEGER NOT NULL,
    "efectivoContadoCentavos" INTEGER NOT NULL,
    "diferenciaCentavos" INTEGER NOT NULL,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ArqueoParcial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ArqueoParcial" ADD CONSTRAINT "ArqueoParcial_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArqueoParcial" ADD CONSTRAINT "ArqueoParcial_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArqueoParcial" ADD CONSTRAINT "ArqueoParcial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArqueoParcial" ADD CONSTRAINT "ArqueoParcial_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
