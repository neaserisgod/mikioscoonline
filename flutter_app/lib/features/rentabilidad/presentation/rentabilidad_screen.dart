import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/rentabilidad/data/rentabilidad_repository.dart';

String _formatearCentavos(int centavos) => r'$' '${(centavos / 100).toStringAsFixed(0)}';

String _dosDigitos(int n) => n.toString().padLeft(2, '0');

class RentabilidadScreen extends ConsumerStatefulWidget {
  const RentabilidadScreen({super.key});

  @override
  ConsumerState<RentabilidadScreen> createState() => _RentabilidadScreenState();
}

class _RentabilidadScreenState extends ConsumerState<RentabilidadScreen> {
  String _agrupador = 'categoria';
  bool _historico = false;
  List<FilaRentabilidad>? _filas;
  String? _error;

  @override
  void initState() {
    super.initState();
    _cargar();
  }

  Future<void> _cargar() async {
    setState(() {
      _filas = null;
      _error = null;
    });
    try {
      String? desde;
      String? hasta;
      if (!_historico) {
        final ahora = DateTime.now();
        final ultimoDia = DateTime(ahora.year, ahora.month + 1, 0).day;
        desde = '${ahora.year}-${_dosDigitos(ahora.month)}-01';
        hasta = '${ahora.year}-${_dosDigitos(ahora.month)}-${_dosDigitos(ultimoDia)}';
      }
      final filas = await ref
          .read(rentabilidadRepositoryProvider)
          .porAgrupador(agrupador: _agrupador, desde: desde, hasta: hasta);
      filas.sort((a, b) => b.gananciaBrutaCentavos.compareTo(a.gananciaBrutaCentavos));
      if (mounted) setState(() => _filas = filas);
    } catch (_) {
      if (mounted) setState(() => _error = 'No se pudo cargar la rentabilidad');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Rentabilidad')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _agrupador,
                    decoration: const InputDecoration(labelText: 'Agrupar por'),
                    items: const [
                      DropdownMenuItem(value: 'categoria', child: Text('Categoría')),
                      DropdownMenuItem(value: 'proveedor', child: Text('Proveedor')),
                      DropdownMenuItem(value: 'heladera', child: Text('Ubicación')),
                      DropdownMenuItem(value: 'caja', child: Text('Caja')),
                    ],
                    onChanged: (v) {
                      if (v != null) {
                        setState(() => _agrupador = v);
                        _cargar();
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Mes actual')),
                    ButtonSegment(value: true, label: Text('Histórico')),
                  ],
                  selected: {_historico},
                  onSelectionChanged: (s) {
                    setState(() => _historico = s.first);
                    _cargar();
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: _error != null
                ? Center(child: Text(_error!))
                : _filas == null
                    ? const Center(child: CircularProgressIndicator())
                    : _filas!.isEmpty
                        ? const Center(child: Text('Sin ventas en el período'))
                        : _RentabilidadContenido(filas: _filas!),
          ),
        ],
      ),
    );
  }
}

class _RentabilidadContenido extends StatelessWidget {
  const _RentabilidadContenido({required this.filas});
  final List<FilaRentabilidad> filas;

  @override
  Widget build(BuildContext context) {
    final top = filas.take(8).toList();
    final maxGanancia = top.map((f) => f.gananciaBrutaCentavos).fold<int>(0, (a, b) => a > b ? a : b);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SizedBox(
          height: 220,
          child: BarChart(
            BarChartData(
              maxY: maxGanancia == 0 ? 1 : maxGanancia * 1.2,
              barGroups: [
                for (var i = 0; i < top.length; i++)
                  BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: top[i].gananciaBrutaCentavos.toDouble(),
                        color: Theme.of(context).colorScheme.primary,
                        width: 18,
                      ),
                    ],
                  ),
              ],
              titlesData: FlTitlesData(
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    getTitlesWidget: (value, meta) {
                      final i = value.toInt();
                      if (i < 0 || i >= top.length) return const SizedBox.shrink();
                      final nombre = top[i].nombre;
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          nombre.length > 8 ? '${nombre.substring(0, 8)}…' : nombre,
                          style: const TextStyle(fontSize: 10),
                        ),
                      );
                    },
                  ),
                ),
                leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              ),
              borderData: FlBorderData(show: false),
              gridData: const FlGridData(show: false),
            ),
          ),
        ),
        const SizedBox(height: 16),
        DataTable(
          columns: const [
            DataColumn(label: Text('Nombre')),
            DataColumn(label: Text('Unid.'), numeric: true),
            DataColumn(label: Text('Ventas'), numeric: true),
            DataColumn(label: Text('Ganancia'), numeric: true),
            DataColumn(label: Text('Markup'), numeric: true),
          ],
          rows: filas
              .map((f) => DataRow(cells: [
                    DataCell(Text(f.nombre)),
                    DataCell(Text('${f.unidadesVendidas}')),
                    DataCell(Text(_formatearCentavos(f.ventasCentavos))),
                    DataCell(Text(_formatearCentavos(f.gananciaBrutaCentavos))),
                    DataCell(Text('${(f.markupBp / 100).toStringAsFixed(1)}%')),
                  ]))
              .toList(),
        ),
      ],
    );
  }
}
