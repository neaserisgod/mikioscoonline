import 'package:kiosco_app/core/network/api_client.dart';

class FilaRentabilidad {
  FilaRentabilidad.fromJson(Map<String, dynamic> json)
      : id = json['id'] as String,
        nombre = json['nombre'] as String,
        unidadesVendidas = json['unidadesVendidas'] as int,
        ventasCentavos = json['ventasCentavos'] as int,
        costoCentavos = json['costoCentavos'] as int,
        gananciaBrutaCentavos = json['gananciaBrutaCentavos'] as int,
        markupBp = json['markupBp'] as int;

  final String id;
  final String nombre;
  final int unidadesVendidas;
  final int ventasCentavos;
  final int costoCentavos;
  final int gananciaBrutaCentavos;
  final int markupBp;
}

class RentabilidadRepository {
  RentabilidadRepository(this._apiClient);
  final ApiClient _apiClient;

  /// [agrupador]: proveedor | heladera | categoria | caja.
  /// Sin [desde]/[hasta] trae el histórico completo (mismo criterio que la web).
  Future<List<FilaRentabilidad>> porAgrupador({
    required String agrupador,
    String? desde,
    String? hasta,
  }) async {
    final resp = await _apiClient.dio.get(
      '/api/rentabilidad',
      queryParameters: {
        'por': agrupador,
        if (desde != null) 'desde': desde,
        if (hasta != null) 'hasta': hasta,
      },
    );
    return (resp.data as List).map((e) => FilaRentabilidad.fromJson(e as Map<String, dynamic>)).toList();
  }
}
