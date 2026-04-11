import 'dart:io';

import 'package:flutter/services.dart' show MissingPluginException;
import 'package:path_provider/path_provider.dart';

/// Returns a usable documents directory.
/// Tries to use path_provider's getApplicationDocumentsDirectory(). If the
/// plugin is missing (MissingPluginException) or an error occurs, falls
/// back to creating and returning a local `app_documents` folder under the
/// current working directory. This avoids crashes in test contexts or when
/// the plugin isn't registered.
Future<Directory> getDocumentsDirectorySafe() async {
  try {
    return await getApplicationDocumentsDirectory();
  } on MissingPluginException catch (e) {
    print(
      'path_provider plugin missing: $e. Falling back to local app_documents.',
    );
  } catch (e) {
    print(
      'Error getting application documents directory: $e. Falling back to local app_documents.',
    );
  }

  final dir = Directory('${Directory.current.path}/app_documents');
  try {
    if (!await dir.exists()) await dir.create(recursive: true);
  } catch (e) {
    print('Failed to create fallback documents directory: $e');
  }
  return dir;
}
