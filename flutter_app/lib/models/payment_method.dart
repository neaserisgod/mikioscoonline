import 'package:freezed_annotation/freezed_annotation.dart';

part 'payment_method.freezed.dart';
part 'payment_method.g.dart';

@freezed
abstract class PaymentMethod with _$PaymentMethod {
  const factory PaymentMethod({
    required String id,
    required String nombre,
    @Default(0) int comisionBp,
    @Default(false) bool esMercadoPago,
    @Default(false) bool esEfectivo,
    @Default(true) bool activo,
    @Default(false) bool esDefault,
    @Default(0) int orden,
    String? cajaId,
    String? mpExternalPosId,
    String? mpTerminalId,
    @Default('PORCENTUAL') String recargoTipo,
    @Default(0) int recargoVirtualBp,
    @Default(0) int recargoVirtualFijoCentavos,
  }) = _PaymentMethod;

  factory PaymentMethod.fromJson(Map<String, dynamic> json) => _$PaymentMethodFromJson(json);
}
