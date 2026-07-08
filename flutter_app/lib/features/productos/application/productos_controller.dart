import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/productos/data/productos_repository.dart';
import 'package:kiosco_app/models/product.dart';

class ProductosController extends AsyncNotifier<List<Product>> {
  late final ProductosRepository _repository;

  @override
  Future<List<Product>> build() async {
    _repository = ref.watch(productosRepositoryProvider);
    return _repository.listar();
  }

  Future<void> recargar() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => _repository.listar());
  }

  Future<void> crear(Map<String, dynamic> data) async {
    await _repository.crear(data);
    await recargar();
  }

  Future<void> editar(String id, Map<String, dynamic> data) async {
    await _repository.editar(id, data);
    await recargar();
  }

  Future<void> desactivar(String id) async {
    await _repository.desactivar(id);
    await recargar();
  }
}

final productosControllerProvider = AsyncNotifierProvider<ProductosController, List<Product>>(
  ProductosController.new,
);

final categoriasParaFormularioProvider = FutureProvider((ref) {
  return ref.watch(productosRepositoryProvider).listarCategorias();
});

final proveedoresParaFormularioProvider = FutureProvider((ref) {
  return ref.watch(productosRepositoryProvider).listarProveedores();
});

final ubicacionesParaFormularioProvider = FutureProvider((ref) {
  return ref.watch(productosRepositoryProvider).listarUbicaciones();
});
