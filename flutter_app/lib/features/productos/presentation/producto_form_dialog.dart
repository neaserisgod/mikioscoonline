import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/features/productos/application/productos_controller.dart';
import 'package:kiosco_app/features/productos/data/productos_repository.dart';
import 'package:kiosco_app/models/product.dart';

/// Devuelve true si guardó con éxito.
Future<bool?> mostrarFormularioProducto(BuildContext context, {Product? producto}) {
  return showDialog<bool>(
    context: context,
    builder: (context) => _ProductoFormDialog(producto: producto),
  );
}

class _ProductoFormDialog extends ConsumerStatefulWidget {
  const _ProductoFormDialog({this.producto});
  final Product? producto;

  @override
  ConsumerState<_ProductoFormDialog> createState() => _ProductoFormDialogState();
}

class _ProductoFormDialogState extends ConsumerState<_ProductoFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _nombreController = TextEditingController(text: widget.producto?.nombre ?? '');
  late final _skuController = TextEditingController(text: widget.producto?.sku ?? '');
  late final _barcodeController = TextEditingController(text: widget.producto?.barcode ?? '');
  late final _precioController = TextEditingController(
    text: widget.producto != null ? (widget.producto!.precioCentavos / 100).toStringAsFixed(2) : '',
  );
  late final _costoController = TextEditingController(
    text: widget.producto != null ? (widget.producto!.costoCentavos / 100).toStringAsFixed(2) : '',
  );
  late bool _esPesable = widget.producto?.esPesable ?? false;
  late String? _categoryId = widget.producto?.categoryId;
  late String? _providerId = widget.producto?.providerId;
  late String? _locationId = widget.producto?.locationId;
  bool _guardando = false;
  String? _error;

  bool get _esEdicion => widget.producto != null;

  @override
  void dispose() {
    _nombreController.dispose();
    _skuController.dispose();
    _barcodeController.dispose();
    _precioController.dispose();
    _costoController.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_categoryId == null) {
      setState(() => _error = 'Elegí una categoría');
      return;
    }

    setState(() {
      _guardando = true;
      _error = null;
    });

    final precioPesos = double.tryParse(_precioController.text.replaceAll(',', '.'));
    final costoPesos = double.tryParse(_costoController.text.replaceAll(',', '.'));

    final data = <String, dynamic>{
      'nombre': _nombreController.text.trim(),
      'categoryId': _categoryId,
      'esPesable': _esPesable,
      if (!_esEdicion && _skuController.text.trim().isNotEmpty) 'sku': _skuController.text.trim(),
      if (_barcodeController.text.trim().isNotEmpty) 'barcode': _barcodeController.text.trim(),
      if (_providerId != null) 'providerId': _providerId,
      if (_locationId != null) 'locationId': _locationId,
      if (_esPesable && precioPesos != null) 'precioPorKgCentavos': (precioPesos * 100).round(),
      if (_esPesable && costoPesos != null) 'costoPorKgCentavos': (costoPesos * 100).round(),
      if (!_esPesable && precioPesos != null) 'precioCentavos': (precioPesos * 100).round(),
      if (!_esPesable && costoPesos != null) 'costoCentavos': (costoPesos * 100).round(),
    };

    try {
      final controller = ref.read(productosControllerProvider.notifier);
      if (_esEdicion) {
        await controller.editar(widget.producto!.id, data);
      } else {
        await controller.crear(data);
      }
      if (mounted) Navigator.pop(context, true);
    } on ProductosException catch (e) {
      setState(() {
        _error = e.mensaje;
        _guardando = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoriasAsync = ref.watch(categoriasParaFormularioProvider);
    final proveedoresAsync = ref.watch(proveedoresParaFormularioProvider);
    final ubicacionesAsync = ref.watch(ubicacionesParaFormularioProvider);

    return AlertDialog(
      title: Text(_esEdicion ? 'Editar producto' : 'Nuevo producto'),
      content: SizedBox(
        width: 400,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  const SizedBox(height: 12),
                ],
                TextFormField(
                  controller: _nombreController,
                  decoration: const InputDecoration(labelText: 'Nombre'),
                  validator: (v) => (v == null || v.isEmpty) ? 'Requerido' : null,
                ),
                const SizedBox(height: 8),
                if (!_esEdicion)
                  TextFormField(
                    controller: _skuController,
                    decoration: const InputDecoration(labelText: 'SKU (opcional)'),
                  ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _barcodeController,
                  decoration: const InputDecoration(labelText: 'Código de barras (opcional)'),
                ),
                const SizedBox(height: 8),
                categoriasAsync.when(
                  data: (categorias) => DropdownButtonFormField<String>(
                    initialValue: _categoryId,
                    decoration: const InputDecoration(labelText: 'Categoría'),
                    items: categorias
                        .map((c) => DropdownMenuItem(value: c.id, child: Text(c.nombre)))
                        .toList(),
                    onChanged: (v) => setState(() => _categoryId = v),
                  ),
                  loading: () => const LinearProgressIndicator(),
                  error: (_, _) => const Text('No se pudieron cargar las categorías'),
                ),
                const SizedBox(height: 8),
                proveedoresAsync.when(
                  data: (proveedores) => DropdownButtonFormField<String>(
                    initialValue: _providerId,
                    decoration: const InputDecoration(labelText: 'Proveedor (opcional)'),
                    items: proveedores
                        .map((p) => DropdownMenuItem(value: p.id, child: Text(p.nombre)))
                        .toList(),
                    onChanged: (v) => setState(() => _providerId = v),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                const SizedBox(height: 8),
                ubicacionesAsync.when(
                  data: (ubicaciones) => DropdownButtonFormField<String>(
                    initialValue: _locationId,
                    decoration: const InputDecoration(labelText: 'Ubicación (opcional)'),
                    items: ubicaciones
                        .map((u) => DropdownMenuItem(value: u.id, child: Text(u.nombre)))
                        .toList(),
                    onChanged: (v) => setState(() => _locationId = v),
                  ),
                  loading: () => const SizedBox.shrink(),
                  error: (_, _) => const SizedBox.shrink(),
                ),
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Se vende por peso (pesable)'),
                  value: _esPesable,
                  onChanged: (v) => setState(() => _esPesable = v),
                ),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _precioController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(labelText: _esPesable ? 'Precio / kg' : 'Precio'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextFormField(
                        controller: _costoController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(labelText: _esPesable ? 'Costo / kg' : 'Costo'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        FilledButton(
          onPressed: _guardando ? null : _guardar,
          child: _guardando
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Guardar'),
        ),
      ],
    );
  }
}
