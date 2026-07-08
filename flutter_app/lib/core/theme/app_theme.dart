import 'package:flutter/material.dart';

/// Aproximación del ámbar de identidad del proyecto web (`--primary` en
/// globals.css, oklch(0.74 0.18 58) en claro / oklch(0.78 0.19 60) en oscuro).
const _seedColor = Color(0xFFD97706);

class AppTheme {
  static ThemeData light = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: _seedColor, brightness: Brightness.light),
    // Sin esto, Material usa el tamaño de widgets pensado para touch/mobile
    // también en desktop — todo se ve sobredimensionado para mouse+teclado.
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: _seedColor, brightness: Brightness.dark),
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );
}
