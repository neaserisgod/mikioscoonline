import 'package:freezed_annotation/freezed_annotation.dart';

import 'package:kiosco_app/models/product.dart';

part 'cart_line.freezed.dart';

/// Línea del carrito en memoria — no es un modelo de la API, solo existe
/// mientras se arma la venta en pantalla.
@freezed
abstract class CartLine with _$CartLine {
  const CartLine._();

  const factory CartLine({
    required Product product,
    required int cantidad,
    int? gramos,
  }) = _CartLine;

  int get subtotalCentavos {
    if (product.esPesable) {
      final precioPorKg = product.precioPorKgCentavos ?? 0;
      return (precioPorKg * (gramos ?? 0) / 1000).round();
    }
    return product.precioCentavos * cantidad;
  }
}
