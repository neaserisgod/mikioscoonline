import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/config/data/config_repository.dart';

String _formatearCentavos(int centavos) => r'$' '${(centavos / 100).toStringAsFixed(2)}';

class GastosFijosScreen extends ConsumerStatefulWidget {
  const GastosFijosScreen({super.key});

  @override
  ConsumerState<GastosFijosScreen> createState() => _GastosFijosScreenState();
}

class _GastosFijosScreenState extends ConsumerState<GastosFijosScreen> {
  List<Map<String, dynamic>>? _items;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    final items = await ref.read(configRepositoryProvider).listarGastosFijos();
    if (mounted) setState(() => _items = items);
  }

  int _montoActual(Map<String, dynamic> item) {
    final montos = item['montos'] as List?;
    if (montos == null || montos.isEmpty) return 0;
    return (montos.first as Map<String, dynamic>)['montoCentavos'] as int;
  }

  Future<void> _crear() async {
    final nombreController = TextEditingController();
    final montoController = TextEditingController();
    final guardar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nuevo gasto fijo'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nombreController, decoration: const InputDecoration(labelText: 'Nombre')),
            TextField(
              controller: montoController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Monto mensual (\$)'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Guardar')),
        ],
      ),
    );
    if (guardar != true) return;

    final pesos = double.tryParse(montoController.text.replaceAll(',', '.')) ?? 0;
    try {
      await ref.read(configRepositoryProvider).crearGastoFijo({
        'nombre': nombreController.text.trim(),
        'montoMensualCentavos': (pesos * 100).round(),
      });
      await _cargar();
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  Future<void> _actualizarMonto(Map<String, dynamic> item) async {
    final montoController = TextEditingController(text: (_montoActual(item) / 100).toStringAsFixed(2));
    final guardar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Monto de ${item['nombre']}'),
        content: TextField(
          controller: montoController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Monto este mes (\$)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Guardar')),
        ],
      ),
    );
    if (guardar != true) return;

    final pesos = double.tryParse(montoController.text.replaceAll(',', '.')) ?? 0;
    try {
      await ref.read(configRepositoryProvider).actualizarMontoGastoFijo(item['id'] as String, (pesos * 100).round());
      await _cargar();
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gastos fijos')),
      floatingActionButton: FloatingActionButton(onPressed: _crear, child: const Icon(Icons.add)),
      body: _items == null
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items!.length,
              itemBuilder: (context, index) {
                final item = _items![index];
                return ListTile(
                  title: Text(item['nombre'] as String),
                  subtitle: Text(_formatearCentavos(_montoActual(item))),
                  onTap: () => _actualizarMonto(item),
                );
              },
            ),
    );
  }
}
