import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/features/productos/application/productos_controller.dart';
import 'package:kiosco_app/features/productos/presentation/producto_form_dialog.dart';
import 'package:kiosco_app/models/product.dart';

String _formatearCentavos(int centavos) => r'$' '${(centavos / 100).toStringAsFixed(2)}';

class ProductosScreen extends ConsumerWidget {
  const ProductosScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productosAsync = ref.watch(productosControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Productos')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => mostrarFormularioProducto(context),
        child: const Icon(Icons.add),
      ),
      body: productosAsync.when(
        data: (productos) => RefreshIndicator(
          onRefresh: () => ref.read(productosControllerProvider.notifier).recargar(),
          child: ListView.builder(
            itemCount: productos.length,
            itemBuilder: (context, index) {
              final producto = productos[index];
              return _ProductoTile(producto: producto);
            },
          ),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error al cargar productos: $e')),
      ),
    );
  }
}

class _ProductoTile extends ConsumerWidget {
  const _ProductoTile({required this.producto});
  final Product producto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListTile(
      title: Text(producto.nombre),
      subtitle: Text(
        producto.esPesable
            ? '${_formatearCentavos(producto.precioPorKgCentavos ?? 0)}/kg · Stock: ${((producto.stockGramos ?? 0) / 1000).toStringAsFixed(2)} kg'
            : '${_formatearCentavos(producto.precioCentavos)} · Stock: ${producto.stock}',
      ),
      trailing: PopupMenuButton<String>(
        onSelected: (value) async {
          if (value == 'editar') {
            await mostrarFormularioProducto(context, producto: producto);
          } else if (value == 'desactivar') {
            await ref.read(productosControllerProvider.notifier).desactivar(producto.id);
          }
        },
        itemBuilder: (context) => [
          const PopupMenuItem(value: 'editar', child: Text('Editar')),
          const PopupMenuItem(value: 'desactivar', child: Text('Desactivar')),
        ],
      ),
    );
  }
}
