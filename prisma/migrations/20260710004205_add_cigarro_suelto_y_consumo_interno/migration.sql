-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "esCigarroSuelto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "esConsumoInterno" BOOLEAN NOT NULL DEFAULT false;
