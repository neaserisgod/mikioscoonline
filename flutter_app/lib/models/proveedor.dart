import 'package:freezed_annotation/freezed_annotation.dart';

part 'proveedor.freezed.dart';
part 'proveedor.g.dart';

// Se llama "Proveedor" (no "Provider", como en el schema de Prisma) para no
// confundirse con el widget Provider — acá usamos Riverpod, pero da lo mismo,
// mejor no dejar la trampa.
@freezed
abstract class Proveedor with _$Proveedor {
  const factory Proveedor({
    required String id,
    required String nombre,
    @Default(true) bool activo,
  }) = _Proveedor;

  factory Proveedor.fromJson(Map<String, dynamic> json) => _$ProveedorFromJson(json);
}
