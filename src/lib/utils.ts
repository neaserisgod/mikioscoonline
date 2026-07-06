import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Minúsculas y sin acentos, para comparar texto ignorando mayúsculas/tildes
// de forma portable entre motores de DB (SQLite no soporta mode: "insensitive").
export function normalizarTexto(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}
