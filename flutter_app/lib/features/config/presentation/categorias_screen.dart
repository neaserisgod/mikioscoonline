import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/config/data/config_repository.dart';

class CategoriasScreen extends ConsumerStatefulWidget {
  const CategoriasScreen({super.key});

  @override
  ConsumerState<CategoriasScreen> createState() => _CategoriasScreenState();
}

class _CategoriasScreenState extends ConsumerState<CategoriasScreen> {
  List<Map<String, dynamic>>? _items;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    final items = await ref.read(configRepositoryProvider).listarCategorias();
    if (mounted) setState(() => _items = items);
  }

  Future<void> _mostrarFormulario({Map<String, dynamic>? item}) async {
    final nombreController = TextEditingController(text: item?['nombre'] as String? ?? '');
    final markupController = TextEditingController(
      text: item != null ? ((item['markupDefaultBp'] as int) / 100).toStringAsFixed(2) : '',
    );

    final guardar = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item == null ? 'Nueva categoría' : 'Editar categoría'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nombreController, decoration: const InputDecoration(labelText: 'Nombre')),
            const SizedBox(height: 8),
            TextField(
              controller: markupController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Margen default (%)'),
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

    final markupPct = double.tryParse(markupController.text.replaceAll(',', '.')) ?? 0;
    final data = {
      'nombre': nombreController.text.trim(),
      'markupDefaultBp': (markupPct * 100).round(),
    };

    try {
      final repo = ref.read(configRepositoryProvider);
      if (item == null) {
        await repo.crearCategoria(data);
      } else {
        await repo.editarCategoria(item['id'] as String, data);
      }
      await _cargar();
    } on ConfigException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.mensaje)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Categorías')),
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
                return ListTile(
                  title: Text(item['nombre'] as String),
                  subtitle: Text('Margen default: ${(item['markupDefaultBp'] as int) / 100}%'),
                  onTap: () => _mostrarFormulario(item: item),
                );
              },
            ),
    );
  }
}
