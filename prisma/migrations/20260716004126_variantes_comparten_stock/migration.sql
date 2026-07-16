-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "unidadesPorVenta" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "variantOfId" TEXT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_variantOfId_fkey" FOREIGN KEY ("variantOfId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
