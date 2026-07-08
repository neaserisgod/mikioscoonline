import 'package:dio/dio.dart';

import 'package:kiosco_app/core/network/api_client.dart';

class ConfigException implements Exception {
  ConfigException(this.mensaje);
  final String mensaje;
}

/// Un solo repositorio para las 7 sub-entidades de Config — todas comparten
/// el mismo patrón REST (GET lista, POST crear, PATCH/[id] editar/activar,
/// DELETE/[id] eliminar), así que no vale la pena separarlas en 7 archivos.
class ConfigRepository {
  ConfigRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Map<String, dynamic>>> _listar(String path) async {
    final resp = await _apiClient.dio.get(path);
    return (resp.data as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> _crear(String path, Map<String, dynamic> data) => _run(() async {
        final resp = await _apiClient.dio.post(path, data: data);
        return resp.data as Map<String, dynamic>;
      });

  Future<void> _patch(String path, Map<String, dynamic> data) => _run(() async {
        await _apiClient.dio.patch(path, data: data);
      });

  Future<void> _delete(String path) => _run(() async {
        await _apiClient.dio.delete(path);
      });

  Future<T> _run<T>(Future<T> Function() fn) async {
    try {
      return await fn();
    } on DioException catch (e) {
      final data = e.response?.data;
      final mensaje = (data is Map && data['error'] is String) ? data['error'] as String : 'Error de conexión';
      throw ConfigException(mensaje);
    }
  }

  // ─── Categorías ──────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listarCategorias() => _listar('/api/config/categorias');
  Future<void> crearCategoria(Map<String, dynamic> data) => _crear('/api/config/categorias', data);
  Future<void> editarCategoria(String id, Map<String, dynamic> data) =>
      _patch('/api/config/categorias/$id', data);
  Future<void> eliminarCategoria(String id) => _delete('/api/config/categorias/$id');

  // ─── Proveedores ─────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listarProveedores() => _listar('/api/config/proveedores');
  Future<void> crearProveedor(String nombre) => _crear('/api/config/proveedores', {'nombre': nombre});
  Future<void> editarProveedor(String id, Map<String, dynamic> data) =>
      _patch('/api/config/proveedores/$id', data);
  Future<void> eliminarProveedor(String id) => _delete('/api/config/proveedores/$id');

  // ─── Ubicaciones ─────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listarUbicaciones() => _listar('/api/config/ubicaciones');
  Future<void> crearUbicacion(String nombre) => _crear('/api/config/ubicaciones', {'nombre': nombre});
  Future<void> editarUbicacion(String id, Map<String, dynamic> data) =>
      _patch('/api/config/ubicaciones/$id', data);
  Future<void> eliminarUbicacion(String id) => _delete('/api/config/ubicaciones/$id');

  // ─── Medios de pago ──────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listarMediosDePago() => _listar('/api/config/medios-pago');
  Future<void> crearMedioPago(Map<String, dynamic> data) => _crear('/api/config/medios-pago', data);
  Future<void> editarMedioPago(String id, Map<String, dynamic> data) =>
      _patch('/api/config/medios-pago/$id', data);
  Future<void> setDefaultMedioPago(String id) => _run(() => _apiClient.dio.post('/api/config/medios-pago/$id/default'));
  Future<void> moverOrdenMedioPago(String id, String direccion) =>
      _run(() => _apiClient.dio.post('/api/config/medios-pago/$id/orden', data: {'direccion': direccion}));

  // ─── Gastos fijos ────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listarGastosFijos() => _listar('/api/config/gastos-fijos');
  Future<void> crearGastoFijo(Map<String, dynamic> data) => _crear('/api/config/gastos-fijos', data);
  Future<void> editarGastoFijo(String id, Map<String, dynamic> data) =>
      _patch('/api/config/gastos-fijos/$id', data);
  Future<void> actualizarMontoGastoFijo(String id, int montoCentavos) =>
      _run(() => _apiClient.dio.post('/api/config/gastos-fijos/$id/monto', data: {'montoCentavos': montoCentavos}));

  // ─── Negocio ─────────────────────────────────────────────────────────────
  Future<Map<String, dynamic>> obtenerNegocio() => _run(() async {
        final resp = await _apiClient.dio.get('/api/config/negocio');
        return resp.data as Map<String, dynamic>;
      });
  Future<void> actualizarNegocio(Map<String, dynamic> data) => _patch('/api/config/negocio', data);

  // ─── Usuarios ────────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> listarUsuarios() => _listar('/api/config/usuarios');
  Future<void> crearUsuario(Map<String, dynamic> data) => _crear('/api/config/usuarios', data);
  Future<void> editarUsuario(String id, Map<String, dynamic> data) => _patch('/api/config/usuarios/$id', data);
}
