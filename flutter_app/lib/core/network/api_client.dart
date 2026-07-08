import 'package:dio/dio.dart';

import 'package:kiosco_app/core/auth/token_storage.dart';
import 'package:kiosco_app/core/network/api_config.dart';

/// Wrapper fino sobre Dio: agrega el JWT a cada request y notifica cuando el
/// backend lo rechaza (token vencido/revocado) para forzar logout.
class ApiClient {
  ApiClient(this._tokenStorage) {
    _dio = Dio(BaseOptions(baseUrl: apiBaseUrl, connectTimeout: const Duration(seconds: 15)));
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.readToken();
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) {
          if (error.response?.statusCode == 401) onUnauthorized?.call();
          handler.next(error);
        },
      ),
    );
  }

  final TokenStorage _tokenStorage;
  late final Dio _dio;

  /// Seteado por el AuthController — dispara logout cuando el server devuelve 401.
  void Function()? onUnauthorized;

  Dio get dio => _dio;
}
