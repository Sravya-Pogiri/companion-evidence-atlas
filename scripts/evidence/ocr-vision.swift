// OCR of scanned PDF pages with Apple's Vision framework (macOS only, no network, no model calls).
//
//   swift scripts/evidence/ocr-vision.swift FILE.pdf OUT_DIR 1 2 3
//
// Writes OUT_DIR/p<N>.txt for each page, one recognised line per line, top to bottom.
// Used for scans that have no text layer and no OCR supplied with the evidence packet.
import Foundation
import PDFKit
import Vision

let args = CommandLine.arguments
guard args.count >= 4, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("usage: ocr-vision.swift FILE.pdf OUT_DIR PAGE...\n".data(using: .utf8)!)
  exit(2)
}
let out = URL(fileURLWithPath: args[2])
try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

for p in args[3...].compactMap({ Int($0) }) {
  guard let page = doc.page(at: p - 1) else { continue }
  let box = page.bounds(for: .mediaBox)
  let scale: CGFloat = 3  // about 216 dpi
  let size = CGSize(width: box.width * scale, height: box.height * scale)
  let image = page.thumbnail(of: size, for: .mediaBox)
  guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  try VNImageRequestHandler(cgImage: cg).perform([request])
  let lines = (request.results ?? [])
    .sorted { $0.boundingBox.minY > $1.boundingBox.minY }
    .compactMap { $0.topCandidates(1).first?.string }
  try lines.joined(separator: "\n").write(to: out.appendingPathComponent("p\(p).txt"), atomically: true, encoding: .utf8)
  print("page \(p): \(lines.count) lines")
}
