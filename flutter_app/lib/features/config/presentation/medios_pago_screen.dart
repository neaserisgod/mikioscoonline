import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/config/data/config_repository.dart';

class MediosPagoScreen extends ConsumerStatefulWidget {
  const MediosPagoScreen({super.key});

  @override
  ConsumerState<MediosPagoScreen> createState() => _MediosPagoScreenState();
}

class _MediosPagoScreenState extends ConsumerState<MediosPagoScreen> {
  List<Map<String, dynamic>>? _items;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    final items = await ref.read(configRepositoryProvider).listarMediosDePago();
    if (mounted) setState(() => _items = items);
  }

  Future<void> _mostrarFormulario({Map<String, dynamic>? item}) async {
    final nombreController = TextEditingController(text: item?['nombre'] as String? ?? '');
    final comisionController = TextEditingController(
      text: item != null ? ((item['comisionBp'] as int) / 100).toStringAsFixed(2) : '0',
    );
    bool esEfectivo = item?['esEfectivo'] as bool? ?? false;

    final guardar = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(item == null ? 'Nuevo medio de pago' : 'Editar medio de pago'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nombreController, decoration: const InputDecoration(labelText: 'Nombre')),
              TextField(
                controller: comisionController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Comisión (%)'),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Es efectivo'),
                value: esEfectivo,
                onChanged: (v) => setState(() => esEfectivo = v),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
            FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Guardar')),
          ],
        ),
      ),
    );
    if (guardar != true) return;

    final comisionPct = double.tryParse(comisionController.text.replaceAll(',', '.')) ?? 0;
    final data = {
      'nombre': nombreController.text.trim(),
      'comisionBp': (comisionPct * 100).round(),
      'esEfectivo': esEfectivo,
    };

    try {
      final repo = ref.read(configRepositoryProvider);
      if (item == null) {
        await repo.crearMedioPago(data);
      } else {
        await repo.editarMedioPago(item['id'] as String, data);
      }
      await _cargar();
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  Future<void> _accion(Future<void> Function() fn) async {
    try {
      await fn();
      await _cargar();
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.read(configRepositoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Medios de pago')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _mostrarFormulario(),
        child: const Icon(Icons.add),
      ),
      body: _items == null
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _items!.length,
              itemBuilder: (context, index) {
                final item = _items![index];
                final activo = item['activo'] as bool? ?? true;
                final esDefault = item['esDefault'] as bool? ?? false;
                return ListTile(
                  leading: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_upward, size: 16),
                        onPressed: () => _accion(() => repo.moverOrdenMedioPago(item['id'] as String, 'arriba')),
                      ),
                      IconButton(
                        icon: const Icon(Icons.arrow_downward, size: 16),
                        onPressed: () => _accion(() => repo.moverOrdenMedioPago(item['id'] as String, 'abajo')),
                      ),
                    ],
                  ),
                  title: Text(item['nombre'] as String),
                  subtitle: Text(
                    '${esDefault ? 'Default · ' : ''}${(item['comisionBp'] as int) / 100}% comisión${activo ? '' : ' · Inactivo'}',
                  ),
                  onTap: () => _mostrarFormulario(item: item),
                  trailing: PopupMenuButton<String>(
                    onSelected: (v) {
                      if (v == 'default') _accion(() => repo.setDefaultMedioPago(item['id'] as String));
                      if (v == 'toggle') {
                        _accion(() => repo.editarMedioPago(item['id'] as String, {'activo': !activo}));
                      }
                    },
                    itemBuilder: (context) => [
                      if (!esDefault) const PopupMenuItem(value: 'default', child: Text('Marcar como default')),
                      PopupMenuItem(value: 'toggle', child: Text(activo ? 'Desactivar' : 'Reactivar')),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
