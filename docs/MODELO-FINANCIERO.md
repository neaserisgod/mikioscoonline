# Modelo financiero del kiosco — cuánto gano y cuánto puedo invertir

> Documento de diseño. Objetivo: que sepas, con un número en el que puedas
> confiar, cuánto ganás de verdad y cuánta plata libre tenés para reinvertir,
> crecer o retirar. Es un marco de gestión, no contabilidad formal — para lo
> impositivo (categoría de monotributo, etc.) confirmá con tu contador.

## El problema en una frase

**La plata en la caja no es toda tuya.** Una parte hay que usarla para reponer lo
que se vendió, otra es de proveedores a los que les debés, otra es del monotributo,
y otra es tu sueldo. Recién lo que sobra **después de todo eso** es ganancia de
verdad. Hoy el sistema frena antes de descontar tu sueldo, el monotributo y la
deuda a proveedores, así que te muestra una "ganancia limpia" más grande de la
real. Por eso no te cierra.

## Dos preguntas distintas (y las dos importan)

El lío de fondo es mezclar dos cosas que parecen la misma y no lo son:

### 1) "¿Cuánto gané este mes?" — el resultado

```
Ventas del mes
  − costo de lo que se vendió   (la mercadería a reponer)
  − comisiones (tarjeta / QR)
  − gastos fijos (alquiler, luz, etc.)
  − monotributo / impuestos
  − tu sueldo objetivo
  ─────────────────────────────
  = GANANCIA REAL del mes
```

Sirve para saber si **el negocio** es rentable — aparte de lo que vos cobrás por
trabajar. Es independiente de cuándo entra o sale la plata.

### 2) "¿Cuánta plata libre tengo hoy?" — la caja

```
Efectivo disponible ahora (todas las cajas)
  − reserva para reponer stock
  − deuda a proveedores por pagar
  − gastos fijos pendientes del mes
  − monotributo del mes
  − tu sueldo (si todavía no lo retiraste)
  ─────────────────────────────
  = PLATA LIBRE de verdad
```

Sirve para saber cuánto podés **sacar o invertir ahora** sin quedar corto la
semana que viene.

**Por qué las dos:** podés haber ganado en el mes y no tener plata libre (está
metida en el stock, o te la deben), o tener la caja llena de plata que en realidad
es de proveedores que vas a tener que pagar. Mirar solo una te engaña. La #1 te
dice si el negocio sirve; la #2 te dice qué podés hacer hoy.

## Ejemplo con números (un mes cualquiera)

| Concepto | Monto |
|---|---|
| Ventas del mes | $3.000.000 |
| − Costo de lo vendido (reponer) | −$2.100.000 |
| **= Margen bruto** | **$900.000** |
| − Comisiones (tarjeta/QR) | −$60.000 |
| − Gastos fijos (alquiler, luz…) | −$250.000 |
| − Monotributo | −$40.000 |
| − Tu sueldo objetivo | −$400.000 |
| **= Ganancia real del mes** | **$150.000** |

Lectura: el negocio ganó **$150.000 limpios** — y eso es **además** de los
$400.000 que ya cobraste como sueldo. Esos $150.000 son los que podés destinar a
crecer, equipar o retirar de más. Si ese número diera negativo, quiere decir que
el negocio no se banca tu sueldo objetivo todavía — dato clave que hoy no ves.

## Repartir la ganancia libre

Una vez que sabés cuánta plata libre real hay, se reparte según tus prioridades:

- **Reponer** lo que se vende (mantener el stock) — ya cubierto por la reserva de
  reposición; no es "ganancia", es capital que gira.
- **Crecer en mercadería** — comprar más de lo que rota o sumar rubros nuevos.
- **Equipamiento / local** — heladera, cartelería, mejoras.
- **Retiro extra** — plata para vos por encima de tu sueldo.

El sistema puede sugerir un reparto (ej. 50% crecer / 30% equipamiento / 20%
retiro) y vos lo ajustás.

## Qué ya tiene el sistema y qué falta

**Ya está:**
- Reserva de reposición por proveedor (`saldoReposicion` + piso).
- Gastos fijos mensuales.
- Deuda a proveedores (cuenta corriente: `saldoCuentaCorrienteProveedor`).
- Una cascada básica (caja − gastos fijos − reposición = "ganancia") y un
  `retirarGanancia` que registra el retiro como egreso.

**Falta:**
- **Tu sueldo objetivo** como parámetro y como línea de la cascada (hoy no existe:
  por eso la "ganancia" te queda inflada con tu propio sueldo adentro).
- **Monotributo** como línea propia y explícita (si hoy no está cargado como gasto
  fijo).
- **Descontar la deuda a proveedores** de la plata libre (comprás mitad a crédito,
  así que esto pesa).
- La **vista de las dos lentes** clara y separada: "resultado del mes" vs "plata
  libre hoy".
- El **reparto sugerido** de la plata libre entre reponer / crecer / equipar /
  retirar.

## Parámetros que tenés que definir vos

- **Sueldo objetivo mensual:** $______ (lo que querés cobrar por trabajar, sí o sí).
- **Monotributo mensual:** $______ (según tu categoría).
- **Reposición:** cómo se calcula el piso por proveedor (ya existe el mecanismo).
- **Prioridad de reparto** de la plata libre (crecer / equipar / retirar).

## Próximos pasos sugeridos (fases)

1. **Cascada completa y correcta:** sumar sueldo objetivo + monotributo + deuda a
   proveedores, para que la "ganancia libre" sea real. (El cambio de mayor impacto.)
2. **Las dos lentes en pantalla:** una vista clara de "resultado del mes" y otra de
   "plata libre hoy", que se entiendan sin explicación.
3. **Reparto e inversión:** sugerencia de cómo repartir la plata libre + una
   proyección simple ("a este ritmo, en X meses juntás para Y").
