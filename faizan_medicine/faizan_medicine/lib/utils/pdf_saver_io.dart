import 'dart:io';
import 'dart:typed_data';

import 'package:open_file/open_file.dart';

import '../utils/documents_helper.dart';

/// Saves PDF bytes to local storage (mobile/desktop) and tries to open it.
/// Returns the full saved file path on success.
Future<String> savePdf(Uint8List bytes, String filename) async {
  final dir = await getDocumentsDirectorySafe();
  final path = '${dir.path}/$filename';
  final file = File(path);
  await file.writeAsBytes(bytes, flush: true);
  try {
    await OpenFile.open(file.path);
  } catch (e) {
    // ignore open errors; file still saved
    print('Failed to open PDF: $e');
  }
  return path;
}
