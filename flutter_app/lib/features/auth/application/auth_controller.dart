import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kiosco_app/core/auth/token_storage.dart';
import 'package:kiosco_app/core/network/api_client.dart';
import 'package:kiosco_app/core/providers.dart';
import 'package:kiosco_app/features/auth/data/auth_repository.dart';
import 'package:kiosco_app/models/usuario.dart';

/// null = no hay sesión. AsyncValue.loading mientras se restaura al abrir la
/// app o mientras se procesa un login.
class AuthController extends AsyncNotifier<Usuario?> {
  late final AuthRepository _repository;
  late final TokenStorage _tokenStorage;
  late final ApiClient _apiClient;

  @override
  Future<Usuario?> build() async {
    _repository = ref.watch(authRepositoryProvider);
    _tokenStorage = ref.watch(tokenStorageProvider);
    _apiClient = ref.watch(apiClientProvider);
    _apiClient.onUnauthorized = _forzarLogout;

    final token = await _tokenStorage.readToken();
    final userJson = await _tokenStorage.readUserJson();
    if (token == null || userJson == null) return null;
    return Usuario.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
  }

  Future<void> login({required String email, required String password}) async {
    state = const AsyncLoading();
    try {
      final result = await _repository.login(email: email, password: password);
      await _guardarSesion(result);
    } catch (e) {
      // Vuelve a "sin sesión" en vez de quedar en AsyncError — el mensaje
      // específico (AuthException.mensaje) lo maneja la pantalla, que hace
      // el catch de este rethrow directamente.
      state = const AsyncData(null);
      rethrow;
    }
  }

  Future<void> loginConGoogle() async {
    state = const AsyncLoading();
    try {
      final result = await _repository.loginConGoogle();
      await _guardarSesion(result);
    } catch (e) {
      state = const AsyncData(null);
      rethrow;
    }
  }

  Future<void> _guardarSesion(LoginResult result) async {
    await _tokenStorage.save(token: result.token, userJson: jsonEncode(result.usuario.toJson()));
    state = AsyncData(result.usuario);
  }

  Future<void> logout() async {
    await _tokenStorage.clear();
    state = const AsyncData(null);
  }

  void _forzarLogout() {
    _tokenStorage.clear();
    state = const AsyncData(null);
  }
}

final authControllerProvider = AsyncNotifierProvider<AuthController, Usuario?>(AuthController.new);
