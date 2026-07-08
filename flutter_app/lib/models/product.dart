import 'package:freezed_annotation/freezed_annotation.dart';

part 'product.freezed.dart';
part 'product.g.dart';

@freezed
abstract class Product with _$Product {
  const factory Product({
    required String id,
    required String sku,
    String? barcode,
    required String nombre,
    // VENDEDOR recibe 0 acá (ver sanitizarProducto en el backend) — no es que
    // el producto no tenga costo, es que ese rol no debe verlo.
    required int costoCentavos,
    required int precioCentavos,
    @Default(false) bool costoEsProvisional,
    required String categoryId,
    String? providerId,
    String? locationId,
    @Default(0) int stock,
    @Default(0) int stockMinimo,
    @Default(false) bool esPesable,
    int? costoPorKgCentavos,
    int? precioPorKgCentavos,
    int? stockGramos,
    int? stockMinimoGramos,
    @Default(true) bool activo,
  }) = _Product;

  factory Product.fromJson(Map<String, dynamic> json) => _$ProductFromJson(json);
}
