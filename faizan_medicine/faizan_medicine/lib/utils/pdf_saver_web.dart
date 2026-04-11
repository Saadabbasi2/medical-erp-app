import 'dart:typed_data';
import 'dart:html' as html;

/// Saves PDF bytes by triggering a browser download (web platform).
/// Returns the filename as confirmation (cannot return a file path on web).
Future<String> savePdf(Uint8List bytes, String filename) async {
  final blob = html.Blob([bytes], 'application/pdf');
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.document.createElement('a') as html.AnchorElement
    ..href = url
    ..style.display = 'none'
    ..download = filename;
  html.document.body!.children.add(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);
  return filename;
}
