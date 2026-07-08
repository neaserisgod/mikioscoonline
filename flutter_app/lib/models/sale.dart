import 'package:freezed_annotation/freezed_annotation.dart';

part 'sale.freezed.dart';
part 'sale.g.dart';

@freezed
abstract class SaleLine with _$SaleLine {
  const factory SaleLine({
    String? id,
    required String productId,
    required int cantidad,
    int? gramos,
    required int precioUnitarioCentavos,
    required int costoUnitarioCentavos,
  }) = _SaleLine;

  factory SaleLine.fromJson(Map<String, dynamic> json) => _$SaleLineFromJson(json);
}

@freezed
abstract class PaymentInput with _$PaymentInput {
  const factory PaymentInput({
    required String paymentMethodId,
    required int montoCentavos,
  }) = _PaymentInput;

  factory PaymentInput.fromJson(Map<String, dynamic> json) => _$PaymentInputFromJson(json);
}

@freezed
abstract class Sale with _$Sale {
  const factory Sale({
    required String id,
    required DateTime fecha,
    required String userId,
    required int totalCentavos,
    required int costoTotalCentavos,
    @Default(0) int recargoCentavos,
    @Default(0) int descuentoCentavos,
    @Default([]) List<SaleLine> lines,
  }) = _Sale;

  factory Sale.fromJson(Map<String, dynamic> json) => _$SaleFromJson(json);
}
