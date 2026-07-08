import 'package:dio/dio.dart';

import 'package:kiosco_app/core/network/api_client.dart';
import 'package:kiosco_app/models/caja.dart';
import 'package:kiosco_app/models/payment_method.dart';
import 'package:kiosco_app/models/product.dart';

class VenderException implements Exception {
  VenderException(this.mensaje);
  final String mensaje;
}

class VenderRepository {
  VenderRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Caja>> listarCajas() async {
    final resp = await _apiClient.dio.get('/api/cajas');
    return (resp.data as List).map((e) => Caja.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<CajaSesion?> sesionAbierta(String cajaId) async {
    final resp = await _apiClient.dio.get('/api/cajas/$cajaId/sesion');
    if (resp.data == null) return null;
    return CajaSesion.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<CajaSesion> abrirCaja(String cajaId, {required int fondoInicialCentavos}) async {
    try {
      final resp = await _apiClient.dio.post(
        '/api/cajas/$cajaId/sesion',
        data: {'fondoInicialCentavos': fondoInicialCentavos},
      );
      return CajaSesion.fromJson(resp.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw VenderException(_mensajeDeError(e));
    }
  }

  Future<void> cerrarCaja(
    String cajaSesionId, {
    required int efectivoContadoCentavos,
    String? nota,
  }) async {
    try {
      await _apiClient.dio.post(
        '/api/cajas/sesion/$cajaSesionId/cerrar',
        data: {'efectivoContadoCentavos': efectivoContadoCentavos, if (nota != null) 'nota': nota},
      );
    } on DioException catch (e) {
      throw VenderException(_mensajeDeError(e));
    }
  }

  Future<List<Product>> buscarProductos({String? q}) async {
    final resp = await _apiClient.dio.get('/api/productos', queryParameters: {if (q != null && q.isNotEmpty) 'q': q});
    return (resp.data as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Product?> buscarPorCodigoBarras(String barcode) async {
    try {
      final resp = await _apiClient.dio.get('/api/productos/codigo/$barcode');
      return Product.fromJson(resp.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<List<PaymentMethod>> listarMediosDePago() async {
    final resp = await _apiClient.dio.get('/api/config/medios-pago');
    return (resp.data as List).map((e) => PaymentMethod.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Devuelve el id de la venta creada.
  Future<String> crearVenta({
    required List<Map<String, dynamic>> lineas,
    required List<Map<String, dynamic>> pagos,
    int? descuentoCentavos,
  }) async {
    try {
      final resp = await _apiClient.dio.post(
        '/api/ventas',
        data: {
          'lineas': lineas,
          'pagos': pagos,
          if (descuentoCentavos != null && descuentoCentavos > 0) 'descuentoCentavos': descuentoCentavos,
        },
      );
      return resp.data['id'] as String;
    } on DioException catch (e) {
      throw VenderException(_mensajeDeError(e));
    }
  }

  String _mensajeDeError(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is String) return data['error'] as String;
    return 'Error de conexión. Intentá de nuevo.';
  }
}
