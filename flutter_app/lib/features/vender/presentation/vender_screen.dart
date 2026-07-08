import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/vender/application/vender_controller.dart';
import 'package:kiosco_app/models/payment_method.dart';
import 'package:kiosco_app/models/product.dart';

String _formatearCentavos(int centavos) {
  final pesos = centavos / 100;
  return r'$' '${pesos.toStringAsFixed(2)}';
}

class VenderScreen extends ConsumerWidget {
  const VenderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(venderControllerProvider);

    if (state.cargandoSesion) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!state.haySesionAbierta) {
      return _AbrirCajaView(error: state.error);
    }

    return const _VenderView();
  }
}

class _AbrirCajaView extends ConsumerStatefulWidget {
  const _AbrirCajaView({this.error});
  final String? error;

  @override
  ConsumerState<_AbrirCajaView> createState() => _AbrirCajaViewState();
}

class _AbrirCajaViewState extends ConsumerState<_AbrirCajaView> {
  final _fondoController = TextEditingController(text: '0');

  @override
  void dispose() {
    _fondoController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vender')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('No hay una caja abierta', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('Ingresá el fondo inicial en efectivo para abrir la caja.'),
                const SizedBox(height: 20),
                if (widget.error != null) ...[
                  Text(widget.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: _fondoController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Fondo inicial (\$)'),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () {
                    final pesos = double.tryParse(_fondoController.text) ?? 0;
                    ref.read(venderControllerProvider.notifier).abrirCaja((pesos * 100).round());
                  },
                  child: const Text('Abrir caja'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _VenderView extends ConsumerStatefulWidget {
  const _VenderView();

  @override
  ConsumerState<_VenderView> createState() => _VenderViewState();
}

class _VenderViewState extends ConsumerState<_VenderView> {
  final _searchController = TextEditingController();
  List<Product> _resultados = [];
  bool _buscando = false;

  Future<void> _buscar(String query) async {
    setState(() => _buscando = true);
    try {
      final repo = ref.read(venderRepositoryProvider);
      final productos = await repo.buscarProductos(q: query);
      if (mounted) setState(() => _resultados = productos);
    } finally {
      if (mounted) setState(() => _buscando = false);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(venderControllerProvider);
    final controller = ref.read(venderControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vender'),
        actions: [
          TextButton.icon(
            onPressed: () => _mostrarCerrarCaja(context, ref),
            icon: const Icon(Icons.point_of_sale),
            label: const Text('Cerrar caja'),
          ),
        ],
      ),
      body: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      labelText: 'Buscar producto',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _buscando
                          ? const Padding(
                              padding: EdgeInsets.all(12),
                              child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                            )
                          : null,
                    ),
                    onSubmitted: _buscar,
                    onChanged: (v) {
                      if (v.length >= 3 || v.isEmpty) _buscar(v);
                    },
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: _resultados.length,
                    itemBuilder: (context, index) {
                      final producto = _resultados[index];
                      return ListTile(
                        title: Text(producto.nombre),
                        subtitle: Text(producto.esPesable
                            ? '${_formatearCentavos(producto.precioPorKgCentavos ?? 0)} / kg'
                            : _formatearCentavos(producto.precioCentavos)),
                        trailing: Text('Stock: ${producto.esPesable ? '${(producto.stockGramos ?? 0) / 1000} kg' : producto.stock}'),
                        onTap: () => _agregarAlCarrito(context, controller, producto),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            flex: 2,
            child: Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    itemCount: state.carrito.length,
                    itemBuilder: (context, index) {
                      final linea = state.carrito[index];
                      return ListTile(
                        title: Text(linea.product.nombre),
                        subtitle: Text(linea.product.esPesable ? '${(linea.gramos ?? 0) / 1000} kg' : 'x${linea.cantidad}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_formatearCentavos(linea.subtotalCentavos)),
                            IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () => controller.quitarLinea(index),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (state.error != null) ...[
                        Text(state.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                        const SizedBox(height: 8),
                      ],
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Total', style: Theme.of(context).textTheme.titleLarge),
                          Text(
                            _formatearCentavos(state.totalCentavos),
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: state.carrito.isEmpty || state.ventaEnProceso
                            ? null
                            : () => _mostrarCheckout(context, ref),
                        child: state.ventaEnProceso
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Cobrar'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _agregarAlCarrito(BuildContext context, VenderController controller, Product producto) {
    if (!producto.esPesable) {
      controller.agregarProducto(producto);
      return;
    }
    showDialog<void>(
      context: context,
      builder: (context) {
        final gramosController = TextEditingController();
        return AlertDialog(
          title: Text(producto.nombre),
          content: TextField(
            controller: gramosController,
            keyboardType: TextInputType.number,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Gramos'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
            FilledButton(
              onPressed: () {
                final gramos = int.tryParse(gramosController.text) ?? 0;
                if (gramos > 0) controller.agregarProducto(producto, gramos: gramos);
                Navigator.pop(context);
              },
              child: const Text('Agregar'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _mostrarCerrarCaja(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cerrar caja'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Efectivo contado (\$)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Cerrar caja')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final pesos = double.tryParse(controller.text) ?? 0;
    await ref.read(venderControllerProvider.notifier).cerrarCaja((pesos * 100).round());
  }

  Future<void> _mostrarCheckout(BuildContext context, WidgetRef ref) async {
    final state = ref.read(venderControllerProvider);
    final mediosAsync = await ref.read(mediosDePagoProvider.future);
    if (!context.mounted) return;

    PaymentMethod? medioSeleccionado = mediosAsync.firstWhere((m) => m.esDefault, orElse: () => mediosAsync.first);

    final confirmado = await showDialog<bool>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) => AlertDialog(
            title: const Text('Cobrar'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Total: ${_formatearCentavos(state.totalCentavos)}'),
                const SizedBox(height: 12),
                DropdownButton<PaymentMethod>(
                  value: medioSeleccionado,
                  isExpanded: true,
                  items: mediosAsync
                      .map((m) => DropdownMenuItem(value: m, child: Text(m.nombre)))
                      .toList(),
                  onChanged: (v) => setState(() => medioSeleccionado = v),
                ),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
              FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Confirmar')),
            ],
          ),
        );
      },
    );

    if (confirmado != true || medioSeleccionado == null || !context.mounted) return;

    final ventaId = await ref.read(venderControllerProvider.notifier).confirmarVenta([
      PagoSeleccionado(medioDePago: medioSeleccionado!, montoCentavos: state.totalCentavos),
    ]);

    if (ventaId != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Venta registrada')));
    }
  }
}
