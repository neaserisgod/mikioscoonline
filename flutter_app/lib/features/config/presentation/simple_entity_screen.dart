import 'package:flutter/material.dart';

/// Pantalla CRUD genérica para entidades config que solo tienen `nombre` +
/// `activo` (Proveedor, Ubicación) — evita duplicar la misma pantalla dos veces.
class SimpleEntityScreen extends StatefulWidget {
  const SimpleEntityScreen({
    super.key,
    required this.titulo,
    required this.listar,
    required this.crear,
    required this.editar,
    required this.eliminar,
  });

  final String titulo;
  final Future<List<Map<String, dynamic>>> Function() listar;
  final Future<void> Function(String nombre) crear;
  final Future<void> Function(String id, String nombre) editar;
  final Future<void> Function(String id) eliminar;

  @override
  State<SimpleEntityScreen> createState() => _SimpleEntityScreenState();
}

class _SimpleEntityScreenState extends State<SimpleEntityScreen> {
  List<Map<String, dynamic>>? _items;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    try {
      final items = await widget.listar();
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) setState(() => _error = 'No se pudo cargar');
    }
  }

  Future<void> _mostrarFormulario({Map<String, dynamic>? item}) async {
    final controller = TextEditingController(text: item?['nombre'] as String? ?? '');
    final nombre = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item == null ? 'Nuevo' : 'Editar'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Nombre'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Guardar')),
        ],
      ),
    );
    if (nombre == null || nombre.isEmpty) return;

    try {
      if (item == null) {
        await widget.crear(nombre);
      } else {
        await widget.editar(item['id'] as String, nombre);
      }
      await _cargar();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.titulo)),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _mostrarFormulario(),
        child: const Icon(Icons.add),
      ),
      body: _error != null
          ? Center(child: Text(_error!))
          : _items == null
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  itemCount: _items!.length,
                  itemBuilder: (context, index) {
                    final item = _items![index];
                    final activo = item['activo'] as bool? ?? true;
                    return ListTile(
                      title: Text(item['nombre'] as String),
                      subtitle: activo ? null : const Text('Inactivo'),
                      trailing: PopupMenuButton<String>(
                        onSelected: (v) async {
                          if (v == 'editar') {
                            await _mostrarFormulario(item: item);
                          } else if (v == 'eliminar') {
                            try {
                              await widget.eliminar(item['id'] as String);
                              await _cargar();
                            } catch (e) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
                              }
                            }
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(value: 'editar', child: Text('Editar')),
                          const PopupMenuItem(value: 'eliminar', child: Text('Eliminar')),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
