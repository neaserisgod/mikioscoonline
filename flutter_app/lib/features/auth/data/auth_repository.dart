import 'package:dio/dio.dart';

import 'package:kiosco_app/core/network/api_client.dart';
import 'package:kiosco_app/features/auth/data/google_oauth_service.dart';
import 'package:kiosco_app/models/usuario.dart';

class LoginResult {
  LoginResult({required this.token, required this.usuario});
  final String token;
  final Usuario usuario;
}

/// Excepción con mensaje ya listo para mostrarle al usuario (no exponemos
/// errores crudos de HTTP/JSON en la UI).
class AuthException implements Exception {
  AuthException(this.mensaje);
  final String mensaje;
}

class AuthRepository {
  AuthRepository(this._apiClient, this._googleOAuth);
  final ApiClient _apiClient;
  final GoogleOAuthService _googleOAuth;

  Future<LoginResult> login({required String email, required String password}) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/auth/mobile-login',
        data: {'email': email, 'password': password},
      );
      return _resultDesdeRespuesta(response);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw AuthException('Email o contraseña incorrectos');
      }
      if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.connectionError) {
        throw AuthException('No se pudo conectar al servidor. Revisá tu conexión a internet.');
      }
      throw AuthException('Error inesperado al iniciar sesión');
    }
  }

  Future<LoginResult> loginConGoogle() async {
    final GoogleAuthCode authCode;
    try {
      authCode = await _googleOAuth.iniciarSesion();
    } on GoogleOAuthException catch (e) {
      throw AuthException(e.mensaje);
    }

    try {
      final response = await _apiClient.dio.post(
        '/api/auth/mobile-google',
        data: {
          'code': authCode.code,
          'codeVerifier': authCode.codeVerifier,
          'redirectUri': authCode.redirectUri,
        },
      );
      return _resultDesdeRespuesta(response);
    } on DioException catch (e) {
      final data = e.response?.data;
      if (data is Map && data['error'] is String) throw AuthException(data['error'] as String);
      throw AuthException('No se pudo iniciar sesión con Google');
    }
  }

  LoginResult _resultDesdeRespuesta(Response response) {
    final data = response.data as Map<String, dynamic>;
    return LoginResult(
      token: data['token'] as String,
      usuario: Usuario.fromJson(data['user'] as Map<String, dynamic>),
    );
  }
}
