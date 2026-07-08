import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:kiosco_app/core/auth/token_storage.dart';
import 'package:kiosco_app/core/network/api_client.dart';
import 'package:kiosco_app/features/auth/data/auth_repository.dart';
import 'package:kiosco_app/features/auth/data/google_oauth_service.dart';
import 'package:kiosco_app/features/config/data/config_repository.dart';
import 'package:kiosco_app/features/productos/data/productos_repository.dart';
import 'package:kiosco_app/features/rentabilidad/data/rentabilidad_repository.dart';
import 'package:kiosco_app/features/vender/data/vender_repository.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return TokenStorage(const FlutterSecureStorage());
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(tokenStorageProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(apiClientProvider), GoogleOAuthService());
});

final venderRepositoryProvider = Provider<VenderRepository>((ref) {
  return VenderRepository(ref.watch(apiClientProvider));
});

final productosRepositoryProvider = Provider<ProductosRepository>((ref) {
  return ProductosRepository(ref.watch(apiClientProvider));
});

final configRepositoryProvider = Provider<ConfigRepository>((ref) {
  return ConfigRepository(ref.watch(apiClientProvider));
});

final rentabilidadRepositoryProvider = Provider<RentabilidadRepository>((ref) {
  return RentabilidadRepository(ref.watch(apiClientProvider));
});
