#pragma once
#include <Windows.h>
#include <filesystem>
#include <functional>
#include <string>
#include <utility>
#include <vector>
class BridgeDispatcher {
 public:
  using Reply = std::function<void(const std::string&)>;
  using PdfExportCompletion = std::function<void(HRESULT, bool)>;
  using PdfExporter = std::function<void(const std::wstring&, PdfExportCompletion)>;
  using DocumentMapper = std::function<void(const std::wstring&)>;

  BridgeDispatcher(HWND owner, PdfExporter pdf_exporter, DocumentMapper document_mapper)
      : owner_(owner),
        pdf_exporter_(std::move(pdf_exporter)),
        document_mapper_(std::move(document_mapper)) {}
  void Dispatch(const std::string& request, Reply reply);
  void SetLaunchDocumentPath(const std::wstring& path);
  void SetCurrentDocumentPath(const std::wstring& path);
  void SetPendingImagePaths(const std::vector<std::filesystem::path>& paths);

 private:
  HWND owner_;
  PdfExporter pdf_exporter_;
  DocumentMapper document_mapper_;
  std::wstring launch_document_path_;
  std::wstring current_document_path_;
  std::vector<std::wstring> pending_image_paths_;
};
