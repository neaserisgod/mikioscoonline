import 'package:dio/dio.dart';

import 'package:kiosco_app/core/network/api_client.dart';
import 'package:kiosco_app/models/category.dart';
import 'package:kiosco_app/models/location.dart';
import 'package:kiosco_app/models/product.dart';
import 'package:kiosco_app/models/proveedor.dart';

class ProductosException implements Exception {
  ProductosException(this.mensaje);
  final String mensaje;
}

class ProductosRepository {
  ProductosRepository(this._apiClient);
  final ApiClient _apiClient;

  Future<List<Product>> listar() async {
    final resp = await _apiClient.dio.get('/api/productos');
    return (resp.data as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Category>> listarCategorias() async {
    final resp = await _apiClient.dio.get('/api/config/categorias');
    return (resp.data as List).map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Proveedor>> listarProveedores() async {
    final resp = await _apiClient.dio.get('/api/config/proveedores');
    return (resp.data as List).map((e) => Proveedor.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Location>> listarUbicaciones() async {
    final resp = await _apiClient.dio.get('/api/config/ubicaciones');
    return (resp.data as List).map((e) => Location.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> crear(Map<String, dynamic> data) async {
    try {
      await _apiClient.dio.post('/api/productos', data: data);
    } on DioException catch (e) {
      throw ProductosException(_mensajeDeError(e));
    }
  }

  Future<void> editar(String id, Map<String, dynamic> data) async {
    try {
      await _apiClient.dio.patch('/api/productos/$id', data: data);
    } on DioException catch (e) {
      throw ProductosException(_mensajeDeError(e));
    }
  }

  Future<void> desactivar(String id) async {
    try {
      await _apiClient.dio.patch('/api/productos/$id', data: {'activo': false});
    } on DioException catch (e) {
      throw ProductosException(_mensajeDeError(e));
    }
  }

  String _mensajeDeError(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is String) return data['error'] as String;
    return 'Error de conexión. Intentá de nuevo.';
  }
}
