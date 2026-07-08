import 'package:freezed_annotation/freezed_annotation.dart';

part 'caja.freezed.dart';
part 'caja.g.dart';

@freezed
abstract class Caja with _$Caja {
  const factory Caja({
    required String id,
    required String nombre,
    @Default(false) bool esPrincipal,
    @Default(0) int orden,
    @Default(true) bool activo,
    int? saldoManualCentavos,
  }) = _Caja;

  factory Caja.fromJson(Map<String, dynamic> json) => _$CajaFromJson(json);
}

@freezed
abstract class CajaSesion with _$CajaSesion {
  const factory CajaSesion({
    required String id,
    required String cajaId,
    required String abiertaPorUserId,
    String? cerradaPorUserId,
    required int fondoInicialCentavos,
    required DateTime fechaApertura,
    DateTime? fechaCierre,
    int? efectivoEsperadoCentavos,
    int? efectivoContadoCentavos,
    int? diferenciaCentavos,
    String? nota,
    required String estado, // "ABIERTA" | "CERRADA"
  }) = _CajaSesion;

  factory CajaSesion.fromJson(Map<String, dynamic> json) => _$CajaSesionFromJson(json);
}
